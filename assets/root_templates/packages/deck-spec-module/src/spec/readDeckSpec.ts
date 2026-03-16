import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const SPEC_DIR_NAME = "spec";
export const DECK_SPEC_FILE_NAME = "deck-spec.json";
export const DECK_SPEC_SCHEMA_FILE_NAME = "deck-spec.schema.json";
export const TMP_DIR_NAME = "tmp";
export const OUTPUT_DIR_NAME = "output";
export const MODULE_ARTIFACT_DIR_NAME = "deck-spec-module";
export const MODULE_RESULT_FILE_NAME = "result.json";
export const MODULE_DIAGNOSTICS_FILE_NAME = "diagnostics.json";
export const MODULE_PRIMARY_CANDIDATE_FILE_NAME = "candidate.primary.json";
export const MODULE_FALLBACK_CANDIDATE_FILE_NAME = "candidate.fallback.json";
export const MODULE_REVIEW_FILE_NAME = "review.final.json";
export const MODULE_GENERATED_ASSETS_MANIFEST_FILE_NAME =
	"generated-assets.manifest.json";
export const MODULE_MEDIA_RESULT_FILE_NAME = "media.result.json";
export const MODULE_MEDIA_FAILURES_FILE_NAME = "media.failures.json";
export const MODULE_REPORT_FILE_NAME = "report.md";

type NodeStyleError = Error & {
	code?: string;
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function resolveProjectDir(projectDir?: string): string {
	return path.resolve(projectDir ?? process.cwd());
}

export function resolveSpecDir(projectDir: string): string {
	return path.join(projectDir, SPEC_DIR_NAME);
}

export function resolveDeckSpecPath(projectDir: string): string {
	return path.join(resolveSpecDir(projectDir), DECK_SPEC_FILE_NAME);
}

export function resolveDeckSpecSchemaPath(projectDir: string): string {
	return path.join(resolveSpecDir(projectDir), DECK_SPEC_SCHEMA_FILE_NAME);
}

export function resolveTmpDir(projectDir: string): string {
	return path.join(projectDir, TMP_DIR_NAME);
}

export function resolveOutputDir(projectDir: string): string {
	return path.join(projectDir, OUTPUT_DIR_NAME);
}

export function findDeckRootForProject(projectDir: string): string | undefined {
	let currentDir = resolveProjectDir(projectDir);

	while (currentDir !== path.dirname(currentDir)) {
		if (hasDeckRootMarker(currentDir)) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}

	return hasDeckRootMarker(currentDir) ? currentDir : undefined;
}

function hasDeckRootMarker(dir: string): boolean {
	return existsSync(path.join(dir, ".ai-native-slides", "root.json"));
}

export function resolveDeckSpecModuleArtifactRootDir(projectDir: string): string {
	const resolvedProjectDir = resolveProjectDir(projectDir);
	const deckRoot = findDeckRootForProject(resolvedProjectDir);
	if (typeof deckRoot !== "string") {
		throw new Error(
			`Could not locate the shared deck root for project: ${resolvedProjectDir}.`,
		);
	}

	return path.join(
		deckRoot,
		TMP_DIR_NAME,
		MODULE_ARTIFACT_DIR_NAME,
		path.basename(resolvedProjectDir),
	);
}

export function resolveModuleResultPath(artifactRootDir: string): string {
	return path.join(artifactRootDir, MODULE_RESULT_FILE_NAME);
}

export function resolveModuleDiagnosticsPath(artifactRootDir: string): string {
	return path.join(artifactRootDir, MODULE_DIAGNOSTICS_FILE_NAME);
}

export function resolveModulePrimaryCandidatePath(
	artifactRootDir: string,
): string {
	return path.join(artifactRootDir, MODULE_PRIMARY_CANDIDATE_FILE_NAME);
}

export function resolveModuleFallbackCandidatePath(
	artifactRootDir: string,
): string {
	return path.join(artifactRootDir, MODULE_FALLBACK_CANDIDATE_FILE_NAME);
}

export function resolveModuleReviewPath(artifactRootDir: string): string {
	return path.join(artifactRootDir, MODULE_REVIEW_FILE_NAME);
}

export function resolveModuleGeneratedAssetsManifestPath(
	artifactRootDir: string,
): string {
	return path.join(artifactRootDir, MODULE_GENERATED_ASSETS_MANIFEST_FILE_NAME);
}

export function resolveModuleMediaResultPath(artifactRootDir: string): string {
	return path.join(artifactRootDir, MODULE_MEDIA_RESULT_FILE_NAME);
}

export function resolveModuleMediaFailuresPath(
	artifactRootDir: string,
): string {
	return path.join(artifactRootDir, MODULE_MEDIA_FAILURES_FILE_NAME);
}

export function resolveModuleReportPath(artifactRootDir: string): string {
	return path.join(artifactRootDir, MODULE_REPORT_FILE_NAME);
}

export async function readJsonFile(
	filePath: string,
	label: string,
): Promise<unknown> {
	try {
		const raw = await readFile(filePath, "utf8");
		try {
			return JSON.parse(raw) as unknown;
		} catch (error) {
			throw new Error(
				`${label} contains invalid JSON at ${filePath}: ${getErrorMessage(error)}`,
			);
		}
	} catch (error) {
		const nodeError = error as NodeStyleError;
		if (nodeError.code === "ENOENT") {
			throw new Error(`${label} is missing at ${filePath}.`);
		}
		if (
			error instanceof Error &&
			error.message.includes("contains invalid JSON")
		) {
			throw error;
		}
		throw new Error(
			`Could not read ${label} at ${filePath}: ${getErrorMessage(error)}`,
		);
	}
}

export async function readDeckSpec(projectDir: string): Promise<unknown> {
	return readJsonFile(resolveDeckSpecPath(projectDir), "deck-spec.json");
}

export async function readDeckSpecSchema(projectDir: string): Promise<unknown> {
	return readJsonFile(
		resolveDeckSpecSchemaPath(projectDir),
		"deck-spec.schema.json",
	);
}
