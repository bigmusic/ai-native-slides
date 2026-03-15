import {
	type DeckSpecPlanningDiagnostics,
	DeckSpecPlanningError,
	type DeckSpecPlanningErrorCode,
	isDeckSpecPlanningError,
	type PlanningAttemptDiagnostics,
	type PlanningAttemptStrategy,
} from "./deck-spec-module/errors.js";
import {
	planDeckSpecRun,
	type PlanDeckSpecRunOptions,
	type PlanningAttemptArtifact,
} from "./deck-spec-module/canonicalization/finalizeDeckSpec.js";
import { renderModuleRunReport } from "./report/renderModuleRunReport.js";
import {
	resolveModuleDiagnosticsPath,
	resolveModuleFallbackCandidatePath,
	resolveModulePrimaryCandidatePath,
	resolveModuleReportPath,
	resolveModuleResultPath,
	resolveModuleReviewPath,
} from "./spec/readDeckSpec.js";
import type { DeckSpec } from "./spec/contract.js";
import type { SpecReviewResult } from "./spec/reviewContract.js";
import {
	runSpecValidateCli,
	validateDeckSpecFileFromPath,
	type DeckSpecValidationResult,
} from "./spec/validateDeckSpec.js";
import { writeJsonFileAtomic, writeTextFileAtomic } from "./spec/writeFileAtomic.js";

export type { DeckSpec } from "./spec/contract.js";
export type {
	DeckSpecPlanningDiagnostics,
	DeckSpecPlanningErrorCode,
	PlanningAttemptDiagnostics,
	PlanningAttemptStrategy,
} from "./deck-spec-module/errors.js";
export {
	DeckSpecPlanningError,
	isDeckSpecPlanningError,
} from "./deck-spec-module/errors.js";

export type DeckSpecModulePaths = {
	canonicalSpecPath: string;
	artifactRootDir: string;
};

export type RunDeckSpecModuleInput = PlanDeckSpecRunOptions & {
	prompt: string;
	paths: DeckSpecModulePaths;
};

export type RunDeckSpecModuleResult = {
	canonicalSpecPath: string;
	artifactRootDir: string;
	usedFallback: boolean;
};

export type RunDeckSpecValidateModuleInput = {
	canonicalSpecPath: string;
	reportPath?: string;
};

type ModuleRunArtifactManifest = {
	ok: boolean;
	prompt: string;
	project_slug: string;
	used_fallback: boolean;
	canonical_spec_path: string;
	artifact_root_dir: string;
	failure?: {
		code: DeckSpecPlanningErrorCode | "unexpected_error";
		message: string;
	};
	attempts: PlanningAttemptDiagnostics[];
	artifact_files: {
		result: string;
		diagnostics: string;
		report: string;
		canonical_spec?: string;
		candidate_primary?: string;
		candidate_fallback?: string;
		review_final?: string;
	};
};

function createArtifactManifest(input: {
	ok: boolean;
	prompt: string;
	projectSlug: string;
	paths: DeckSpecModulePaths;
	diagnostics: DeckSpecPlanningDiagnostics;
	review?: SpecReviewResult;
	error?: {
		code: DeckSpecPlanningErrorCode | "unexpected_error";
		message: string;
	};
	attempts: PlanningAttemptArtifact[];
}): ModuleRunArtifactManifest {
	const artifactFiles: ModuleRunArtifactManifest["artifact_files"] = {
		result: resolveModuleResultPath(input.paths.artifactRootDir),
		diagnostics: resolveModuleDiagnosticsPath(input.paths.artifactRootDir),
		report: resolveModuleReportPath(input.paths.artifactRootDir),
	};

	if (input.ok) {
		artifactFiles.canonical_spec = input.paths.canonicalSpecPath;
	}

	if (input.attempts.some((attempt) => attempt.strategy === "primary")) {
		artifactFiles.candidate_primary = resolveModulePrimaryCandidatePath(
			input.paths.artifactRootDir,
		);
	}

	if (input.attempts.some((attempt) => attempt.strategy === "fallback")) {
		artifactFiles.candidate_fallback = resolveModuleFallbackCandidatePath(
			input.paths.artifactRootDir,
		);
	}

	if (input.review) {
		artifactFiles.review_final = resolveModuleReviewPath(
			input.paths.artifactRootDir,
		);
	}

	return {
		ok: input.ok,
		prompt: input.prompt,
		project_slug: input.projectSlug,
		used_fallback: input.diagnostics.used_fallback,
		canonical_spec_path: input.paths.canonicalSpecPath,
		artifact_root_dir: input.paths.artifactRootDir,
		failure: input.error,
		attempts: input.diagnostics.attempts,
		artifact_files: artifactFiles,
	};
}

async function writeAttemptArtifacts(
	artifactRootDir: string,
	attempts: PlanningAttemptArtifact[],
): Promise<void> {
	for (const attempt of attempts) {
		if (!attempt.candidateDeckSpec) {
			continue;
		}

		if (attempt.strategy === "primary") {
			await writeJsonFileAtomic(
				resolveModulePrimaryCandidatePath(artifactRootDir),
				attempt.candidateDeckSpec,
			);
			continue;
		}

		await writeJsonFileAtomic(
			resolveModuleFallbackCandidatePath(artifactRootDir),
			attempt.candidateDeckSpec,
		);
	}
}

async function writeRunArtifacts(input: {
	ok: boolean;
	prompt: string;
	projectSlug: string;
	paths: DeckSpecModulePaths;
	diagnostics: DeckSpecPlanningDiagnostics;
	attempts: PlanningAttemptArtifact[];
	review?: SpecReviewResult;
	deckSpec?: DeckSpec;
	error?: {
		code: DeckSpecPlanningErrorCode | "unexpected_error";
		message: string;
	};
}): Promise<void> {
	const manifest = createArtifactManifest({
		ok: input.ok,
		prompt: input.prompt,
		projectSlug: input.projectSlug,
		paths: input.paths,
		diagnostics: input.diagnostics,
		review: input.review,
		error: input.error,
		attempts: input.attempts,
	});

	await writeAttemptArtifacts(input.paths.artifactRootDir, input.attempts);
	await writeJsonFileAtomic(
		resolveModuleDiagnosticsPath(input.paths.artifactRootDir),
		input.diagnostics,
	);

	if (input.review) {
		await writeJsonFileAtomic(
			resolveModuleReviewPath(input.paths.artifactRootDir),
			input.review,
		);
	}

	if (input.ok && input.deckSpec) {
		await writeJsonFileAtomic(input.paths.canonicalSpecPath, input.deckSpec);
	}

	await writeJsonFileAtomic(
		resolveModuleResultPath(input.paths.artifactRootDir),
		manifest,
	);
	await writeTextFileAtomic(
		resolveModuleReportPath(input.paths.artifactRootDir),
		`${renderModuleRunReport({
			ok: input.ok,
			prompt: input.prompt,
			projectSlug: input.projectSlug,
			canonicalSpecPath: input.paths.canonicalSpecPath,
			artifactRootDir: input.paths.artifactRootDir,
			diagnostics: input.diagnostics,
			review: input.review,
			error: input.error,
		})}\n`,
	);
}

export async function runDeckSpecModule(
	input: RunDeckSpecModuleInput,
): Promise<RunDeckSpecModuleResult> {
	const run = await planDeckSpecRun(input.prompt, {
		projectSlug: input.projectSlug,
		generatedAt: input.generatedAt,
		specVersion: input.specVersion,
		apiKey: input.apiKey,
		model: input.model,
		seed: input.seed,
	});

	if (run.ok) {
		await writeRunArtifacts({
			ok: true,
			prompt: input.prompt,
			projectSlug: input.projectSlug,
			paths: input.paths,
			diagnostics: run.diagnostics,
			attempts: run.attempts,
			review: run.review,
			deckSpec: run.deckSpec,
		});
		return {
			canonicalSpecPath: input.paths.canonicalSpecPath,
			artifactRootDir: input.paths.artifactRootDir,
			usedFallback: run.diagnostics.used_fallback,
		};
	}

	await writeRunArtifacts({
		ok: false,
		prompt: input.prompt,
		projectSlug: input.projectSlug,
		paths: input.paths,
		diagnostics: run.diagnostics,
		attempts: run.attempts,
		review: run.attempts.at(-1)?.review,
		error: {
			code: run.error.code,
			message: run.error.message,
		},
	});
	throw run.error;
}

function renderValidationReport(
	canonicalSpecPath: string,
	result: DeckSpecValidationResult,
): string {
	if (result.ok) {
		return [
			"# Deck-Spec Validation",
			"",
			"- Status: VALID",
			`- Canonical Spec Path: ${canonicalSpecPath}`,
			"",
		].join("\n");
	}

	return [
		"# Deck-Spec Validation",
		"",
		"- Status: INVALID",
		`- Canonical Spec Path: ${canonicalSpecPath}`,
		"",
		...result.errors.map((error) => `- ${error.path}: ${error.message}`),
		"",
	].join("\n");
}

export async function runDeckSpecValidateModule(
	input: RunDeckSpecValidateModuleInput,
): Promise<{ ok: true }> {
	const result = await validateDeckSpecFileFromPath(input.canonicalSpecPath);
	if (typeof input.reportPath === "string") {
		await writeTextFileAtomic(
			input.reportPath,
			renderValidationReport(input.canonicalSpecPath, result),
		);
	}

	if (!result.ok) {
		throw new Error(
			[
				`Deck spec validation failed: ${input.canonicalSpecPath}`,
				...result.errors.map((error) => `- ${error.path}: ${error.message}`),
			].join("\n"),
		);
	}

	return { ok: true };
}

export { runSpecValidateCli };
