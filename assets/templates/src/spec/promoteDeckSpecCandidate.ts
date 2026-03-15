import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { DeckSpec, DeckSpecCandidate } from "./contract.js";
import { normalizeSystemManagedFields } from "./normalizeSystemManagedFields.js";
import type { PlannerContext } from "./plannerContext.js";
import {
	skillRetryableSpecPromotionFailureKinds,
	validatePlannerContextDocument,
} from "./plannerContext.js";
import {
	readDeckSpecSchema,
	readJsonFile,
	resolveDeckSpecBackupPath,
	resolveDeckSpecPath,
	resolvePlannerContextPath,
	resolveProjectDir,
	resolveReviewBriefBackupPath,
	resolveReviewBriefPath,
	resolveReviewContextBackupPath,
	resolveReviewContextPath,
	resolveSpecCandidatePath,
} from "./readDeckSpec.js";
import {
	createReviewContext,
	renderReviewBriefMarkdown,
} from "./reviewContext.js";
import type { CliIo, DeckSpecValidationError } from "./validateDeckSpec.js";
import {
	validateDeckSpecDocument,
	validateDeckSpecFile,
} from "./validateDeckSpec.js";
import {
	copyFileIfExists,
	removeFileIfExists,
	writeJsonFileAtomic,
	writeTextFileAtomic,
} from "./writeFileAtomic.js";

type ReviewHandoffArtifacts = {
	reviewContextPath: string;
	reviewBriefPath: string;
};

type SpecPromotionDependencies = {
	writeReviewHandoffArtifacts?: (
		projectDir: string,
		spec: DeckSpec,
	) => Promise<ReviewHandoffArtifacts>;
};

const millisecondTimestampSuffixPattern = /\.\d{3}Z$/;

export type SpecPromotionFailureKind =
	| "candidate_invalid_json"
	| "candidate_validation_failed"
	| "candidate_missing"
	| "planner_context_invalid"
	| "planner_context_missing"
	| "deck_spec_schema_unavailable"
	| "io_error"
	| "unexpected_error";

type DeckSpecPromotionResult =
	| {
			ok: true;
			specPath: string;
			candidatePath: string;
			reviewContextPath: string;
			reviewBriefPath: string;
			warnings?: string[];
	  }
	| {
			ok: false;
			specPath: string;
			candidatePath: string;
			contextPath: string;
			failureKind: SpecPromotionFailureKind;
			retryable: boolean;
			message?: string;
			errors?: DeckSpecValidationError[];
			warnings?: string[];
	  };

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

function createCanonicalTimestamp(): string {
	return new Date()
		.toISOString()
		.replace(millisecondTimestampSuffixPattern, "Z");
}

function getCliErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: `Unknown error: ${String(error)}`;
}

function isRetryableSpecPromotionFailureKind(
	failureKind: SpecPromotionFailureKind,
): boolean {
	return (
		skillRetryableSpecPromotionFailureKinds as readonly string[]
	).includes(failureKind);
}

function createPromotionFailureResult(input: {
	specPath: string;
	candidatePath: string;
	contextPath: string;
	failureKind: SpecPromotionFailureKind;
	message?: string;
	errors?: DeckSpecValidationError[];
	warnings?: string[];
}): Extract<DeckSpecPromotionResult, { ok: false }> {
	return {
		ok: false,
		specPath: input.specPath,
		candidatePath: input.candidatePath,
		contextPath: input.contextPath,
		failureKind: input.failureKind,
		retryable: isRetryableSpecPromotionFailureKind(input.failureKind),
		message: input.message,
		errors: input.errors,
		warnings: input.warnings,
	};
}

function classifyCandidateReadFailure(
	error: unknown,
): SpecPromotionFailureKind {
	const message = getCliErrorMessage(error);
	if (message.includes("spec candidate contains invalid JSON")) {
		return "candidate_invalid_json";
	}
	if (message.includes("spec candidate is missing")) {
		return "candidate_missing";
	}
	return "io_error";
}

function classifyUnexpectedFailure(error: unknown): SpecPromotionFailureKind {
	const message = getCliErrorMessage(error);
	if (
		message.includes("Could not read") ||
		message.includes("Could not write") ||
		message.includes("EACCES") ||
		message.includes("ENOENT")
	) {
		return "io_error";
	}
	return "unexpected_error";
}

async function restorePreviousDeckSpec(
	specPath: string,
	backupPath: string,
	hadExistingSpec: boolean,
): Promise<void> {
	if (hadExistingSpec) {
		const backupDocument = await readJsonFile(backupPath, "deck-spec backup");
		await writeJsonFileAtomic(specPath, backupDocument);
		return;
	}

	await removeFileIfExists(specPath);
}

async function restorePreviousArtifact(
	filePath: string,
	backupPath: string,
	hadExistingArtifact: boolean,
): Promise<void> {
	if (hadExistingArtifact) {
		await copyFileIfExists(backupPath, filePath);
		return;
	}

	await removeFileIfExists(filePath);
}

async function writeReviewHandoffArtifacts(
	projectDir: string,
	spec: DeckSpec,
): Promise<ReviewHandoffArtifacts> {
	const context = createReviewContext(projectDir, spec);

	await writeJsonFileAtomic(context.paths.review_context_path, context);
	await writeTextFileAtomic(
		context.paths.review_brief_path,
		`${renderReviewBriefMarkdown(context)}\n`,
	);

	return {
		reviewContextPath: context.paths.review_context_path,
		reviewBriefPath: context.paths.review_brief_path,
	};
}

async function resolveSourcePrompt(
	projectDir: string,
	candidateDocument: unknown,
): Promise<
	| {
			ok: true;
			sourcePrompt: string;
			warnings: string[];
	  }
	| {
			ok: false;
			failureKind: "planner_context_invalid" | "planner_context_missing";
			message: string;
	  }
> {
	const contextPath = resolvePlannerContextPath(projectDir);
	if (existsSync(contextPath)) {
		const contextDocument = await readJsonFile(contextPath, "planner context");
		const contextValidation = validatePlannerContextDocument(
			contextDocument,
			projectDir,
		);

		if (!contextValidation.ok) {
			return {
				ok: false,
				failureKind: "planner_context_invalid",
				message: [
					`planner context is invalid at ${contextPath}.`,
					...contextValidation.errors.map(
						(error) => `- ${error.path}: ${error.message}`,
					),
				].join("\n"),
			};
		}

		return {
			ok: true,
			sourcePrompt: (contextDocument as PlannerContext).source_prompt,
			warnings: [],
		};
	}

	if (
		typeof candidateDocument === "object" &&
		candidateDocument !== null &&
		"source_prompt" in candidateDocument &&
		typeof candidateDocument.source_prompt === "string" &&
		candidateDocument.source_prompt.trim().length > 0
	) {
		return {
			ok: true,
			sourcePrompt: candidateDocument.source_prompt,
			warnings: [
				`planner context is missing at ${contextPath}; falling back to candidate.source_prompt. This legacy fallback is deprecated.`,
			],
		};
	}

	return {
		ok: false,
		failureKind: "planner_context_missing",
		message: `Missing planner context at ${contextPath}, and candidate.source_prompt is unavailable for legacy fallback.`,
	};
}

export async function promoteDeckSpecCandidate(
	projectDir: string,
	dependencies: SpecPromotionDependencies = {},
): Promise<DeckSpecPromotionResult> {
	const candidatePath = resolveSpecCandidatePath(projectDir);
	const specPath = resolveDeckSpecPath(projectDir);
	const backupPath = resolveDeckSpecBackupPath(projectDir);
	const contextPath = resolvePlannerContextPath(projectDir);
	const reviewContextPath = resolveReviewContextPath(projectDir);
	const reviewBriefPath = resolveReviewBriefPath(projectDir);
	const reviewContextBackupPath = resolveReviewContextBackupPath(projectDir);
	const reviewBriefBackupPath = resolveReviewBriefBackupPath(projectDir);

	try {
		let schema: unknown;
		try {
			schema = await readDeckSpecSchema(projectDir);
		} catch (error) {
			return createPromotionFailureResult({
				specPath: specPath,
				candidatePath: candidatePath,
				contextPath: contextPath,
				failureKind: "deck_spec_schema_unavailable",
				message: getCliErrorMessage(error),
			});
		}

		let candidateDocument: unknown;
		try {
			candidateDocument = await readJsonFile(candidatePath, "spec candidate");
		} catch (error) {
			return createPromotionFailureResult({
				specPath: specPath,
				candidatePath: candidatePath,
				contextPath: contextPath,
				failureKind: classifyCandidateReadFailure(error),
				message: getCliErrorMessage(error),
			});
		}

		const sourcePromptResult = await resolveSourcePrompt(
			projectDir,
			candidateDocument,
		);
		if (!sourcePromptResult.ok) {
			return createPromotionFailureResult({
				specPath: specPath,
				candidatePath: candidatePath,
				contextPath: contextPath,
				failureKind: sourcePromptResult.failureKind,
				message: sourcePromptResult.message,
			});
		}
		const normalizedPlan = normalizeSystemManagedFields(
			candidateDocument as DeckSpecCandidate,
			{
				projectSlug: path.basename(projectDir),
				sourcePrompt: sourcePromptResult.sourcePrompt,
				generatedAt: createCanonicalTimestamp(),
			},
		);
		const preflightValidation = validateDeckSpecDocument(
			normalizedPlan,
			schema as object,
			{
				projectDir: projectDir,
			},
		);

		if (!preflightValidation.ok) {
			return createPromotionFailureResult({
				specPath: specPath,
				candidatePath: candidatePath,
				contextPath: contextPath,
				failureKind: "candidate_validation_failed",
				errors: preflightValidation.errors,
				warnings: sourcePromptResult.warnings,
			});
		}

		const hadExistingSpec = await copyFileIfExists(specPath, backupPath);
		let hadExistingReviewContext = false;
		let hadExistingReviewBrief = false;
		let reviewHandoffWriteStarted = false;

		try {
			await writeJsonFileAtomic(specPath, normalizedPlan);
			const persistedValidation = await validateDeckSpecFile(projectDir);
			if (!persistedValidation.ok) {
				await restorePreviousDeckSpec(specPath, backupPath, hadExistingSpec);
				return createPromotionFailureResult({
					specPath: specPath,
					candidatePath: candidatePath,
					contextPath: contextPath,
					failureKind: "candidate_validation_failed",
					errors: persistedValidation.errors,
					warnings: sourcePromptResult.warnings,
				});
			}

			hadExistingReviewContext = await copyFileIfExists(
				reviewContextPath,
				reviewContextBackupPath,
			);
			hadExistingReviewBrief = await copyFileIfExists(
				reviewBriefPath,
				reviewBriefBackupPath,
			);
			reviewHandoffWriteStarted = true;
			const reviewHandoff =
				(await dependencies.writeReviewHandoffArtifacts?.(
					projectDir,
					normalizedPlan as DeckSpec,
				)) ??
				(await writeReviewHandoffArtifacts(
					projectDir,
					normalizedPlan as DeckSpec,
				));

			return {
				ok: true,
				specPath: specPath,
				candidatePath: candidatePath,
				reviewContextPath: reviewHandoff.reviewContextPath,
				reviewBriefPath: reviewHandoff.reviewBriefPath,
				warnings: sourcePromptResult.warnings,
			};
		} catch (error) {
			await restorePreviousDeckSpec(specPath, backupPath, hadExistingSpec);
			if (reviewHandoffWriteStarted) {
				await restorePreviousArtifact(
					reviewContextPath,
					reviewContextBackupPath,
					hadExistingReviewContext,
				);
				await restorePreviousArtifact(
					reviewBriefPath,
					reviewBriefBackupPath,
					hadExistingReviewBrief,
				);
			}

			return createPromotionFailureResult({
				specPath: specPath,
				candidatePath: candidatePath,
				contextPath: contextPath,
				failureKind: "io_error",
				message: `Could not write review handoff artifacts: ${getCliErrorMessage(error)}`,
				warnings: sourcePromptResult.warnings,
			});
		} finally {
			await removeFileIfExists(backupPath);
			await removeFileIfExists(reviewContextBackupPath);
			await removeFileIfExists(reviewBriefBackupPath);
		}
	} catch (error) {
		return createPromotionFailureResult({
			specPath: specPath,
			candidatePath: candidatePath,
			contextPath: contextPath,
			failureKind: classifyUnexpectedFailure(error),
			message: getCliErrorMessage(error),
		});
	}
}

export async function runSpecCli(
	args: string[],
	io: CliIo = defaultCliIo,
	dependencies: SpecPromotionDependencies = {},
): Promise<number> {
	const projectDir = resolveProjectDir(args[0]);
	const result = await promoteDeckSpecCandidate(projectDir, dependencies);

	if (result.ok) {
		io.stdout(`Deck spec promoted: ${result.specPath}`);
		io.stdout(`Candidate source: ${result.candidatePath}`);
		io.stdout(`Review context written: ${result.reviewContextPath}`);
		io.stdout(`Review brief written: ${result.reviewBriefPath}`);
		for (const warning of result.warnings ?? []) {
			io.stderr(warning);
		}
		return 0;
	}

	io.stderr(`Deck spec promotion failed: ${result.candidatePath}`);
	io.stderr(`Canonical target: ${result.specPath}`);
	io.stderr(`Planner context: ${result.contextPath}`);
	io.stderr(`Failure kind: ${result.failureKind}`);
	io.stderr(`Retryable by skill: ${result.retryable ? "yes" : "no"}`);
	if (result.message) {
		io.stderr(result.message);
	}
	if (result.errors) {
		for (const error of result.errors) {
			io.stderr(`- ${error.path}: ${error.message}`);
		}
	}
	for (const warning of result.warnings ?? []) {
		io.stderr(warning);
	}
	return 1;
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runSpecCli(process.argv.slice(2));
	process.exit(exitCode);
}
