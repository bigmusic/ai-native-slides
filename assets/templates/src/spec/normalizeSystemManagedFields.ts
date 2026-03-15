import {
	DEFAULT_DECK_SPEC_VERSION,
	type DeckImageAsset,
	type DeckImageAssetCandidate,
	type DeckSpec,
	type DeckSpecCandidate,
	type DeckSpecStatus,
	deckSpecStatusValues,
	type ImageAssetStatus,
	imageAssetStatusValues,
	type SharedVisualAsset,
	type SharedVisualAssetCandidate,
	type SlideStatus,
	slideStatusValues,
	type TextAsset,
	type TextAssetCandidate,
	type TextAssetStatus,
	textAssetStatusValues,
} from "./contract.js";
import { deriveOutputFileName } from "./deriveOutputFileName.js";

type NormalizeOptions = {
	projectSlug: string;
	sourcePrompt: string;
	generatedAt?: string;
	specVersion?: string;
	specStatus?: DeckSpecStatus;
	slideStatus?: SlideStatus;
	textAssetStatus?: TextAssetStatus;
	imageAssetStatus?: ImageAssetStatus;
};

function defaultGeneratedAt(): string {
	return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeTextAsset(
	asset: TextAssetCandidate,
	status: TextAssetStatus,
): TextAsset {
	return {
		...asset,
		status,
	} as TextAsset;
}

function normalizeImageAsset(asset: DeckImageAssetCandidate): DeckImageAsset {
	return {
		...asset,
		output_file_name: deriveOutputFileName(asset as DeckImageAsset),
	} as DeckImageAsset;
}

function normalizeImageAssetWithStatus(
	asset: DeckImageAssetCandidate,
	status: ImageAssetStatus,
): DeckImageAsset {
	return {
		...normalizeImageAsset(asset),
		status,
	};
}

function normalizeSharedAsset(
	asset: SharedVisualAssetCandidate,
): SharedVisualAsset {
	return {
		...asset,
		output_file_name: deriveOutputFileName(asset as SharedVisualAsset),
	} as SharedVisualAsset;
}

function normalizeSharedAssetWithStatus(
	asset: SharedVisualAssetCandidate,
	status: ImageAssetStatus,
): SharedVisualAsset {
	return {
		...normalizeSharedAsset(asset),
		status,
	};
}

export function normalizeSystemManagedFields(
	deckSpecCandidate: DeckSpecCandidate,
	options: NormalizeOptions,
): DeckSpec {
	const generatedAt =
		options.generatedAt ??
		deckSpecCandidate.generated_at ??
		defaultGeneratedAt();
	const specStatus = options.specStatus ?? deckSpecStatusValues[0];
	const slideStatus = options.slideStatus ?? slideStatusValues[0];
	const textAssetStatus = options.textAssetStatus ?? textAssetStatusValues[0];
	const imageAssetStatus =
		options.imageAssetStatus ?? imageAssetStatusValues[0];

	return {
		...deckSpecCandidate,
		spec_version:
			options.specVersion ??
			deckSpecCandidate.spec_version ??
			DEFAULT_DECK_SPEC_VERSION,
		generated_at: generatedAt,
		project_slug: options.projectSlug,
		source_prompt: options.sourcePrompt,
		status: specStatus,
		slides: deckSpecCandidate.slides.map((slide) => ({
			...slide,
			status: slideStatus,
		})),
		asset_manifest: {
			...deckSpecCandidate.asset_manifest,
			text_assets: deckSpecCandidate.asset_manifest.text_assets.map((asset) =>
				normalizeTextAsset(asset, textAssetStatus),
			),
			image_assets: deckSpecCandidate.asset_manifest.image_assets.map((asset) =>
				normalizeImageAssetWithStatus(asset, imageAssetStatus),
			),
			shared_assets: deckSpecCandidate.asset_manifest.shared_assets.map(
				(asset) => normalizeSharedAssetWithStatus(asset, imageAssetStatus),
			),
		},
	};
}
