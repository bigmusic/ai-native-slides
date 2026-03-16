import path from "node:path";
import { fileURLToPath } from "node:url";

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
import {
	createMediaArtifacts,
	createNotStartedMediaArtifacts,
	type DeckSpecMediaPhaseArtifacts,
} from "./deck-spec-module/media/materializeDeckSpecMedia.js";
import { materializeDeckSpecMedia } from "./deck-spec-module/media/materializeDeckSpecMedia.js";
import { renderModuleRunReport } from "./report/renderModuleRunReport.js";
import {
	resolveModuleDiagnosticsPath,
	resolveModuleFallbackCandidatePath,
	resolveModuleGeneratedAssetsManifestPath,
	resolveModuleMediaFailuresPath,
	resolveModuleMediaResultPath,
	resolveModulePrimaryCandidatePath,
	resolveModuleReportPath,
	resolveModuleResultPath,
	resolveModuleReviewPath,
} from "./spec/readDeckSpec.js";
import type { DeckSpec } from "./spec/contract.js";
import type { SpecReviewResult } from "./spec/reviewContract.js";
import {
	runSpecValidateCli,
	type DeckSpecValidationResult,
	validateDeckSpecFileFromPath,
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
export type {
	DeckSpecValidationError,
	DeckSpecValidationResult,
} from "./spec/validateDeckSpec.js";
export {
	runSpecValidateCli,
	validateDeckSpecDocument,
	validateDeckSpecFile,
	validateDeckSpecFileFromPath,
} from "./spec/validateDeckSpec.js";

export type DeckSpecModulePaths = {
	canonicalSpecPath: string;
	artifactRootDir: string;
	mediaOutputDir?: string;
};

export type RunDeckSpecModuleInput = PlanDeckSpecRunOptions & {
	prompt: string;
	paths: DeckSpecModulePaths;
	media?: {
		enabled?: boolean;
	};
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

const packageRootDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

function isPathInsideDir(targetPath: string, dirPath: string): boolean {
	const relativePath = path.relative(dirPath, path.resolve(targetPath));
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
	);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
}

function assertExternalRuntimePath(
	targetPath: string,
	label: string,
): void {
	if (targetPath.trim() === "") {
		throw new DeckSpecPlanningError({
			code: "planning_failed",
			message: `Missing ${label}. Pass an explicit external path.`,
		});
	}

	if (isPathInsideDir(targetPath, packageRootDir)) {
		throw new DeckSpecPlanningError({
			code: "planning_failed",
			message: `${label} must be outside the deck-spec-module package directory.`,
		});
	}
}

function isMediaEnabled(input: RunDeckSpecModuleInput): boolean {
	return input.media?.enabled !== false;
}

function assertModuleOutputPaths(input: RunDeckSpecModuleInput): void {
	assertExternalRuntimePath(input.paths.canonicalSpecPath, "canonicalSpecPath");
	assertExternalRuntimePath(input.paths.artifactRootDir, "artifactRootDir");

	if (isMediaEnabled(input)) {
		assertExternalRuntimePath(input.paths.mediaOutputDir ?? "", "mediaOutputDir");
		return;
	}

	if (typeof input.paths.mediaOutputDir === "string") {
		assertExternalRuntimePath(input.paths.mediaOutputDir, "mediaOutputDir");
	}
}

type ModuleRunArtifactManifest = {
	ok: boolean;
	prompt: string;
	project_slug: string;
	used_fallback: boolean;
	canonical_spec_path: string;
	artifact_root_dir: string;
	media_output_dir?: string;
	failure?: {
		code: DeckSpecPlanningErrorCode | "unexpected_error";
		message: string;
	};
	attempts: PlanningAttemptDiagnostics[];
	media: DeckSpecMediaPhaseArtifacts;
	artifact_files: {
		result: string;
		diagnostics: string;
		generated_assets_manifest: string;
		media_result: string;
		media_failures: string;
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
	canonicalSpecPublished: boolean;
	diagnostics: DeckSpecPlanningDiagnostics;
	media: DeckSpecMediaPhaseArtifacts;
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
		generated_assets_manifest: resolveModuleGeneratedAssetsManifestPath(
			input.paths.artifactRootDir,
		),
		media_result: resolveModuleMediaResultPath(input.paths.artifactRootDir),
		media_failures: resolveModuleMediaFailuresPath(input.paths.artifactRootDir),
		report: resolveModuleReportPath(input.paths.artifactRootDir),
	};

	if (input.canonicalSpecPublished) {
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
		media_output_dir: input.media.media_output_dir,
		failure: input.error,
		attempts: input.diagnostics.attempts,
		media: input.media,
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
	canonicalSpecPublished: boolean;
	diagnostics: DeckSpecPlanningDiagnostics;
	media: DeckSpecMediaPhaseArtifacts;
	attempts: PlanningAttemptArtifact[];
	review?: SpecReviewResult;
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
		canonicalSpecPublished: input.canonicalSpecPublished,
		diagnostics: input.diagnostics,
		media: input.media,
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

	await writeJsonFileAtomic(
		resolveModuleGeneratedAssetsManifestPath(input.paths.artifactRootDir),
		input.media.manifest,
	);
	await writeJsonFileAtomic(
		resolveModuleMediaResultPath(input.paths.artifactRootDir),
		{
			enabled: input.media.enabled,
			status: input.media.status,
			media_output_dir: input.media.media_output_dir,
			generated_asset_ids: input.media.generated_asset_ids,
			unchanged_asset_ids: input.media.unchanged_asset_ids,
			final_spec_status: input.media.final_spec_status,
		},
	);
	await writeJsonFileAtomic(
		resolveModuleMediaFailuresPath(input.paths.artifactRootDir),
		input.media.failures,
	);
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
			media: input.media,
			review: input.review,
			error: input.error,
		})}\n`,
	);
}

function createMediaFailureMessage(media: DeckSpecMediaPhaseArtifacts): string {
	if (media.failures.length === 0) {
		return "Media generation failed before any asset result was recorded.";
	}

	return [
		`Media generation failed for ${media.failures.length} asset(s).`,
		...media.failures.map(
			(failure) => `- ${failure.asset_id}: ${failure.message}`,
		),
	].join("\n");
}

export async function runDeckSpecModule(
	input: RunDeckSpecModuleInput,
): Promise<RunDeckSpecModuleResult> {
	assertModuleOutputPaths(input);
	const run = await planDeckSpecRun(input.prompt, {
		projectSlug: input.projectSlug,
		generatedAt: input.generatedAt,
		specVersion: input.specVersion,
		apiKey: input.apiKey,
		model: input.model,
		seed: input.seed,
	});

	if (run.ok) {
		const mediaEnabled = isMediaEnabled(input);
		let finalDeckSpec = run.deckSpec;
		let mediaArtifacts = createMediaArtifacts({
			enabled: mediaEnabled,
			mediaOutputDir: input.paths.mediaOutputDir,
			deckSpec: finalDeckSpec,
		});

		await writeJsonFileAtomic(input.paths.canonicalSpecPath, finalDeckSpec);

		if (mediaEnabled) {
			try {
				const mediaResult = await materializeDeckSpecMedia({
					deckSpec: finalDeckSpec,
					mediaOutputDir: input.paths.mediaOutputDir ?? "",
					apiKey: input.apiKey,
				});
				finalDeckSpec = mediaResult.deckSpec;
				mediaArtifacts = createMediaArtifacts({
					enabled: true,
					mediaOutputDir: input.paths.mediaOutputDir,
					deckSpec: finalDeckSpec,
					result: mediaResult,
				});
				await writeJsonFileAtomic(input.paths.canonicalSpecPath, finalDeckSpec);
			} catch (error) {
				const wrappedError = new DeckSpecPlanningError({
					code: "media_generation_failed",
					message: getErrorMessage(error),
					diagnostics: run.diagnostics,
				});
				await writeRunArtifacts({
					ok: false,
					prompt: input.prompt,
					projectSlug: input.projectSlug,
					paths: input.paths,
					canonicalSpecPublished: true,
					diagnostics: run.diagnostics,
					media: mediaArtifacts,
					attempts: run.attempts,
					review: run.review,
					error: {
						code: wrappedError.code,
						message: wrappedError.message,
					},
				});
				throw wrappedError;
			}
		}

		await writeRunArtifacts({
			ok: mediaArtifacts.status !== "failed",
			prompt: input.prompt,
			projectSlug: input.projectSlug,
			paths: input.paths,
			canonicalSpecPublished: true,
			diagnostics: run.diagnostics,
			media: mediaArtifacts,
			attempts: run.attempts,
			review: run.review,
			error:
				mediaArtifacts.status === "failed"
					? {
						code: "media_generation_failed",
						message: createMediaFailureMessage(mediaArtifacts),
					}
					: undefined,
		});

		if (mediaArtifacts.status === "failed") {
			throw new DeckSpecPlanningError({
				code: "media_generation_failed",
				message: createMediaFailureMessage(mediaArtifacts),
				diagnostics: run.diagnostics,
			});
		}

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
		canonicalSpecPublished: false,
		diagnostics: run.diagnostics,
		media: createNotStartedMediaArtifacts(),
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
	assertExternalRuntimePath(input.canonicalSpecPath, "canonicalSpecPath");
	if (typeof input.reportPath === "string") {
		assertExternalRuntimePath(input.reportPath, "reportPath");
	}

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
