import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const SPEC_DIR_NAME = "spec";
export const DECK_SPEC_FILE_NAME = "deck-spec.json";
export const DECK_SPEC_SCHEMA_FILE_NAME = "deck-spec.schema.json";
export const TMP_DIR_NAME = "tmp";
export const OUTPUT_DIR_NAME = "output";
export const SPEC_CANDIDATE_FILE_NAME = "spec-candidate.json";
export const SPEC_CANDIDATE_LAST_INVALID_FILE_NAME =
	"spec-candidate.last-invalid.json";
export const SPEC_CANDIDATE_LAST_ERRORS_FILE_NAME =
	"spec-candidate.last-errors.txt";
export const PLANNER_CONTEXT_FILE_NAME = "planner-context.json";
export const PLANNER_BRIEF_FILE_NAME = "planner-brief.md";
export const DECK_SPEC_BACKUP_FILE_NAME = "deck-spec.backup.json";
export const REVIEW_CONTEXT_FILE_NAME = "review-context.json";
export const REVIEW_CONTEXT_BACKUP_FILE_NAME = "review-context.backup.json";
export const REVIEW_BRIEF_FILE_NAME = "review-brief.md";
export const REVIEW_BRIEF_BACKUP_FILE_NAME = "review-brief.backup.md";
export const SPEC_REVIEW_CANDIDATE_FILE_NAME = "spec-review-candidate.json";
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

export function resolveSpecCandidateLastInvalidPath(
	projectDir: string,
): string {
	return path.join(
		resolveTmpDir(projectDir),
		SPEC_CANDIDATE_LAST_INVALID_FILE_NAME,
	);
}

export function resolveSpecCandidateLastErrorsPath(projectDir: string): string {
	return path.join(
		resolveTmpDir(projectDir),
		SPEC_CANDIDATE_LAST_ERRORS_FILE_NAME,
	);
}

export function resolvePlannerContextPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), PLANNER_CONTEXT_FILE_NAME);
}

export function resolvePlannerBriefPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), PLANNER_BRIEF_FILE_NAME);
}

export function resolveDeckSpecBackupPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), DECK_SPEC_BACKUP_FILE_NAME);
}

export function resolveReviewContextPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), REVIEW_CONTEXT_FILE_NAME);
}

export function resolveReviewContextBackupPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), REVIEW_CONTEXT_BACKUP_FILE_NAME);
}

export function resolveReviewBriefPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), REVIEW_BRIEF_FILE_NAME);
}

export function resolveReviewBriefBackupPath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), REVIEW_BRIEF_BACKUP_FILE_NAME);
}

export function resolveSpecReviewCandidatePath(projectDir: string): string {
	return path.join(resolveTmpDir(projectDir), SPEC_REVIEW_CANDIDATE_FILE_NAME);
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
