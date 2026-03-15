import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const SPEC_DIR_NAME = "spec";
export const DECK_SPEC_FILE_NAME = "deck-spec.json";
export const DECK_SPEC_SCHEMA_FILE_NAME = "deck-spec.schema.json";
export const TMP_DIR_NAME = "tmp";
export const OUTPUT_DIR_NAME = "output";
export const SPEC_CANDIDATE_FILE_NAME = "spec-candidate.json";
export const SPEC_DIAGNOSTICS_FILE_NAME = "spec-diagnostics.json";
export const SPEC_REVIEW_FILE_NAME = "spec-review.json";
export const SPEC_REVIEW_MARKDOWN_FILE_NAME = "spec-review.md";

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

export function resolveSpecCandidatePath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), SPEC_CANDIDATE_FILE_NAME);
}

export function resolveSpecDiagnosticsPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), SPEC_DIAGNOSTICS_FILE_NAME);
}

export function resolveSpecReviewPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), SPEC_REVIEW_FILE_NAME);
}

export function resolveSpecReviewMarkdownPath(projectDir: string): string {
	return path.join(
		resolveOutputDir(projectDir),
		SPEC_REVIEW_MARKDOWN_FILE_NAME,
	);
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
