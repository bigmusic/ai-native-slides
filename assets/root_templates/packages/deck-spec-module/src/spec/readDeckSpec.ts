import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import type {
	BulletListAsset,
	DeckImageAsset,
	DeckSpec,
	SharedVisualAsset,
	SlidePlan,
	TextAsset,
} from "./contract.js";

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

function isRecord(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(
	value: unknown,
	label: string,
): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new Error(`Expected ${label} to be an object.`);
	}

	return value;
}

function assertArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) {
		throw new Error(`Expected ${label} to be an array.`);
	}

	return value;
}

function assertString(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Expected ${label} to be a non-empty string.`);
	}

	return value;
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

export function readJsonFileSync(
	filePath: string,
	label: string,
): unknown {
	try {
		const raw = readFileSync(filePath, "utf8");
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

export function readDeckSpecSync(projectDir: string): unknown {
	return readJsonFileSync(resolveDeckSpecPath(projectDir), "deck-spec.json");
}

export async function readDeckSpecSchema(projectDir: string): Promise<unknown> {
	return readJsonFile(
		resolveDeckSpecSchemaPath(projectDir),
		"deck-spec.schema.json",
	);
}

export function assertDeckSpecShape(
	document: unknown,
	label = "deck-spec.json",
): DeckSpec {
	const deckSpec = assertRecord(document, label);
	const slides = assertArray(deckSpec.slides, `${label}.slides`);
	const assetManifest = assertRecord(
		deckSpec.asset_manifest,
		`${label}.asset_manifest`,
	);

	assertArray(assetManifest.text_assets, `${label}.asset_manifest.text_assets`);
	assertArray(
		assetManifest.image_assets,
		`${label}.asset_manifest.image_assets`,
	);
	assertArray(
		assetManifest.shared_assets,
		`${label}.asset_manifest.shared_assets`,
	);

	slides.forEach((slide, index) => {
		const slideRecord = assertRecord(slide, `${label}.slides[${index}]`);
		assertString(
			slideRecord.slide_id,
			`${label}.slides[${index}].slide_id`,
		);
		assertString(
			slideRecord.layout_intent,
			`${label}.slides[${index}].layout_intent`,
		);
		const contentBlocks = assertArray(
			slideRecord.content_blocks,
			`${label}.slides[${index}].content_blocks`,
		);
		contentBlocks.forEach((block, blockIndex) => {
			const blockRecord = assertRecord(
				block,
				`${label}.slides[${index}].content_blocks[${blockIndex}]`,
			);
			assertString(
				blockRecord.block_type,
				`${label}.slides[${index}].content_blocks[${blockIndex}].block_type`,
			);
		});
	});

	return deckSpec as DeckSpec;
}

export async function readTypedDeckSpec(projectDir: string): Promise<DeckSpec> {
	return assertDeckSpecShape(
		await readDeckSpec(projectDir),
		resolveDeckSpecPath(projectDir),
	);
}

export function readTypedDeckSpecSync(projectDir: string): DeckSpec {
	return assertDeckSpecShape(
		readDeckSpecSync(projectDir),
		resolveDeckSpecPath(projectDir),
	);
}

export function findSlideById(
	deckSpec: DeckSpec,
	slideId: string,
): SlidePlan | undefined {
	return deckSpec.slides.find((slide) => slide.slide_id === slideId);
}

export function requireSlideById(
	deckSpec: DeckSpec,
	slideId: string,
): SlidePlan {
	const slide = findSlideById(deckSpec, slideId);
	if (!slide) {
		throw new Error(`Missing slide_id "${slideId}" in deck-spec.json.`);
	}

	return slide;
}

export function findTextAssetById(
	deckSpec: DeckSpec,
	assetId: string,
): TextAsset | undefined {
	return deckSpec.asset_manifest.text_assets.find(
		(asset) => asset.asset_id === assetId,
	);
}

export function requireTextAssetById(
	deckSpec: DeckSpec,
	assetId: string,
): TextAsset {
	const asset = findTextAssetById(deckSpec, assetId);
	if (!asset) {
		throw new Error(`Missing text asset "${assetId}" in deck-spec.json.`);
	}

	return asset;
}

export function requirePlainTextAssetContent(
	deckSpec: DeckSpec,
	assetId: string,
): string {
	const asset = requireTextAssetById(deckSpec, assetId);
	if (asset.text_kind !== "plain_text") {
		throw new Error(
			`Text asset "${assetId}" is ${asset.text_kind}, expected plain_text.`,
		);
	}

	return asset.content;
}

export function requireBulletListAssetContent(
	deckSpec: DeckSpec,
	assetId: string,
): string[] {
	const asset = requireTextAssetById(deckSpec, assetId);
	if (asset.text_kind !== "bullet_list") {
		throw new Error(
			`Text asset "${assetId}" is ${asset.text_kind}, expected bullet_list.`,
		);
	}

	return asset.content;
}

export function findImageAssetById(
	deckSpec: DeckSpec,
	assetId: string,
): DeckImageAsset | undefined {
	return deckSpec.asset_manifest.image_assets.find(
		(asset) => asset.asset_id === assetId,
	);
}

export function requireImageAssetById(
	deckSpec: DeckSpec,
	assetId: string,
): DeckImageAsset {
	const asset = findImageAssetById(deckSpec, assetId);
	if (!asset) {
		throw new Error(`Missing image asset "${assetId}" in deck-spec.json.`);
	}

	return asset;
}

export function findSharedAssetById(
	deckSpec: DeckSpec,
	assetId: string,
): SharedVisualAsset | undefined {
	return deckSpec.asset_manifest.shared_assets.find(
		(asset) => asset.asset_id === assetId,
	);
}

export function requireSharedAssetById(
	deckSpec: DeckSpec,
	assetId: string,
): SharedVisualAsset {
	const asset = findSharedAssetById(deckSpec, assetId);
	if (!asset) {
		throw new Error(`Missing shared asset "${assetId}" in deck-spec.json.`);
	}

	return asset;
}
