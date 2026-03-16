import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import type {
	DeckImageAsset,
	DeckSpec,
	ImageAssetStatus,
	SharedVisualAsset,
} from "../../spec/contract.js";
import { writeBufferFileAtomic } from "../../spec/writeFileAtomic.js";
import {
	resolveGeneratedImageAssetPath,
	resolveGeneratedImageAssetsDir,
} from "./generatedImagePaths.js";
import {
	type GeneratedImage,
	type GenerateGeminiImageRequest,
	generateImageWithGemini,
} from "./geminiImageProvider.js";
import { normalizeGeneratedImage } from "./imagePolicy.js";
import {
	compileProviderImagePrompt,
	type PlannedImageAsset,
} from "./providerPrompt.js";

export type MediaPhaseStatus = "not_started" | "skipped" | "passed" | "failed";

export type AssetFailure = {
	asset_id: string;
	message: string;
};

export type GeneratedAssetManifestEntry = {
	asset_id: string;
	asset_kind: "image" | "shared";
	output_file_name: string;
	output_path: string;
	required: boolean;
	exists: boolean;
	status: ImageAssetStatus;
};

export type DeckSpecMediaPhaseArtifacts = {
	enabled: boolean;
	status: MediaPhaseStatus;
	media_output_dir?: string;
	generated_asset_ids: string[];
	unchanged_asset_ids: string[];
	failures: AssetFailure[];
	manifest: GeneratedAssetManifestEntry[];
	final_spec_status?: DeckSpec["status"];
};

type RequiredImageAsset = DeckImageAsset | SharedVisualAsset;

type GenerateImageFn = (
	request: GenerateGeminiImageRequest,
) => Promise<GeneratedImage>;

type MaterializeDeckSpecMediaInput = {
	deckSpec: DeckSpec;
	mediaOutputDir: string;
	apiKey: string;
	generateImage?: GenerateImageFn;
};

type MaterializeDeckSpecMediaResult = {
	ok: boolean;
	deckSpec: DeckSpec;
	generatedAssetIds: string[];
	unchangedAssetIds: string[];
	failures: AssetFailure[];
	manifest: GeneratedAssetManifestEntry[];
};

function collectRequiredAssets(plan: DeckSpec): RequiredImageAsset[] {
	return [
		...plan.asset_manifest.image_assets,
		...plan.asset_manifest.shared_assets,
	].filter((asset) => asset.required);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function updateStatusFromFile(
	status: ImageAssetStatus,
	fileExists: boolean,
): ImageAssetStatus {
	if (!fileExists) {
		return status;
	}

	return status === "planned" ? "generated" : status;
}

function updateSpecWithGeneratedMedia(
	spec: DeckSpec,
	mediaOutputDir: string,
): DeckSpec {
	const imageAssets = spec.asset_manifest.image_assets.map((asset) => {
		const fileExists = existsSync(
			resolveGeneratedImageAssetPath(mediaOutputDir, asset.output_file_name),
		);
		return {
			...asset,
			status: updateStatusFromFile(asset.status, fileExists),
		};
	});
	const sharedAssets = spec.asset_manifest.shared_assets.map((asset) => {
		const fileExists = existsSync(
			resolveGeneratedImageAssetPath(mediaOutputDir, asset.output_file_name),
		);
		return {
			...asset,
			status: updateStatusFromFile(asset.status, fileExists),
		};
	});
	const allRequiredFilesExist = [...imageAssets, ...sharedAssets]
		.filter((asset) => asset.required)
		.every((asset) =>
			existsSync(
				resolveGeneratedImageAssetPath(mediaOutputDir, asset.output_file_name),
			),
		);

	return {
		...spec,
		status: allRequiredFilesExist ? "media_ready" : "reviewed",
		asset_manifest: {
			...spec.asset_manifest,
			image_assets: imageAssets,
			shared_assets: sharedAssets,
		},
	};
}

function createGeneratedAssetManifest(
	spec: DeckSpec,
	mediaOutputDir: string,
): GeneratedAssetManifestEntry[] {
	return [
		...spec.asset_manifest.image_assets.map((asset) => ({
			asset_id: asset.asset_id,
			asset_kind: "image" as const,
			output_file_name: asset.output_file_name,
			output_path: resolveGeneratedImageAssetPath(
				mediaOutputDir,
				asset.output_file_name,
			),
			required: asset.required,
			exists: existsSync(
				resolveGeneratedImageAssetPath(mediaOutputDir, asset.output_file_name),
			),
			status: asset.status,
		})),
		...spec.asset_manifest.shared_assets.map((asset) => ({
			asset_id: asset.asset_id,
			asset_kind: "shared" as const,
			output_file_name: asset.output_file_name,
			output_path: resolveGeneratedImageAssetPath(
				mediaOutputDir,
				asset.output_file_name,
			),
			required: asset.required,
			exists: existsSync(
				resolveGeneratedImageAssetPath(mediaOutputDir, asset.output_file_name),
			),
			status: asset.status,
		})),
	];
}

async function generateAndWriteAsset(
	mediaOutputDir: string,
	apiKey: string,
	asset: PlannedImageAsset,
	generateImage: GenerateImageFn,
): Promise<void> {
	const prompt = compileProviderImagePrompt(asset);
	const generatedImage = await generateImage({
		apiKey,
		prompt,
		aspectRatio: asset.aspect_ratio,
	});
	const normalizedImage = await normalizeGeneratedImage({
		sourceBuffer: generatedImage.imageBytes,
		outputFormat: asset.output_format,
		sizeTier: asset.size_tier,
		aspectRatio: asset.aspect_ratio,
		intendedUsage: asset.intended_usage,
	});

	await writeBufferFileAtomic(
		resolveGeneratedImageAssetPath(mediaOutputDir, asset.output_file_name),
		normalizedImage,
	);
}

export function createSkippedMediaArtifacts(
	deckSpec: DeckSpec,
	mediaOutputDir?: string,
): DeckSpecMediaPhaseArtifacts {
	return {
		enabled: false,
		status: "skipped",
		media_output_dir: mediaOutputDir,
		generated_asset_ids: [],
		unchanged_asset_ids: [],
		failures: [],
		manifest:
			typeof mediaOutputDir === "string"
				? createGeneratedAssetManifest(deckSpec, mediaOutputDir)
				: [],
		final_spec_status: deckSpec.status,
	};
}

export function createNotStartedMediaArtifacts(): DeckSpecMediaPhaseArtifacts {
	return {
		enabled: true,
		status: "not_started",
		generated_asset_ids: [],
		unchanged_asset_ids: [],
		failures: [],
		manifest: [],
	};
}

export async function materializeDeckSpecMedia(
	input: MaterializeDeckSpecMediaInput,
): Promise<MaterializeDeckSpecMediaResult> {
	const generateImage = input.generateImage ?? generateImageWithGemini;
	const requiredAssets = collectRequiredAssets(input.deckSpec);

	if (requiredAssets.length === 0) {
		const updatedDeckSpec = {
			...input.deckSpec,
			status: "media_ready" as const,
		};
		return {
			ok: true,
			deckSpec: updatedDeckSpec,
			generatedAssetIds: [],
			unchangedAssetIds: [],
			failures: [],
			manifest: createGeneratedAssetManifest(updatedDeckSpec, input.mediaOutputDir),
		};
	}

	await mkdir(resolveGeneratedImageAssetsDir(input.mediaOutputDir), {
		recursive: true,
	});

	const generatedAssetIds: string[] = [];
	const failures: AssetFailure[] = [];

	for (const asset of requiredAssets) {
		try {
			await generateAndWriteAsset(
				input.mediaOutputDir,
				input.apiKey,
				asset,
				generateImage,
			);
			generatedAssetIds.push(asset.asset_id);
		} catch (error) {
			failures.push({
				asset_id: asset.asset_id,
				message: getErrorMessage(error),
			});
		}
	}

	const updatedDeckSpec = updateSpecWithGeneratedMedia(
		input.deckSpec,
		input.mediaOutputDir,
	);

	return {
		ok: failures.length === 0,
		deckSpec: updatedDeckSpec,
		generatedAssetIds,
		unchangedAssetIds: [],
		failures,
		manifest: createGeneratedAssetManifest(updatedDeckSpec, input.mediaOutputDir),
	};
}

export function createMediaArtifacts(input: {
	enabled: boolean;
	mediaOutputDir?: string;
	deckSpec: DeckSpec;
	result?: MaterializeDeckSpecMediaResult;
}): DeckSpecMediaPhaseArtifacts {
	if (!input.enabled) {
		return createSkippedMediaArtifacts(input.deckSpec, input.mediaOutputDir);
	}

	if (!input.result) {
		return createNotStartedMediaArtifacts();
	}

	return {
		enabled: true,
		status: input.result.ok ? "passed" : "failed",
		media_output_dir: input.mediaOutputDir,
		generated_asset_ids: input.result.generatedAssetIds,
		unchanged_asset_ids: input.result.unchangedAssetIds,
		failures: input.result.failures,
		manifest: input.result.manifest,
		final_spec_status: input.result.deckSpec.status,
	};
}
