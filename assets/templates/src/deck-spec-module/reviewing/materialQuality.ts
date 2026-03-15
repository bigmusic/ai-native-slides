import type { DeckSpec, TextAsset } from "../../spec/contract.js";

export const placeholderTextPatterns = [
	/\bplaceholder\b/i,
	/\btodo\b/i,
	/\blorem ipsum\b/i,
	/\bcoming soon\b/i,
	/\bwrite this\b/i,
] as const;

export const plannerMaterialAuthoringRules = [
	"Write deck-ready copy, not placeholder text.",
	"Titles, bullets, callouts, and captions should read like final presentation material.",
	"Match text asset kinds to their intended block types and slide roles.",
	"Keep slide objectives, text assets, and slide mapping mutually consistent.",
] as const;

export const reviewMaterialGuidance = [
	"Check whether the canonical text assets already read like presenter-facing deck copy.",
	"Treat placeholder copy, vague bullets, or weak deck framing as semantic quality issues.",
	"Prefer citing the exact slide and asset ids that show narrative drift or underdeveloped material.",
] as const;

export const materialQualitySignalSeverityValues = ["warn", "fail"] as const;
export type MaterialQualitySignalSeverity =
	(typeof materialQualitySignalSeverityValues)[number];

export const materialQualitySignalIds = [
	"placeholder_copy",
	"underdeveloped_copy",
	"audience_tone_drift",
	"missing_required_visual_mapping",
	"explicit_audience_framing_missing",
] as const;
export type MaterialQualitySignalId = (typeof materialQualitySignalIds)[number];

export type MaterialQualitySignal = {
	id: MaterialQualitySignalId;
	severity: MaterialQualitySignalSeverity;
	message: string;
	related_slide_ids: string[];
	related_asset_ids: string[];
};

const shortFormAssetPattern = /\b(badge|title|value|label)\b/i;
const executiveAudiencePattern =
	/\b(executive|leadership|board|non-technical|business audience)\b/i;
const audienceFramingPromptPattern = /\baudience framing slide\b/i;
const audienceFramingPromptCountPattern =
	/\b(\d+|one|two|three)\s+audience framing slides?\b/i;
const workflowDetailPromptPattern = /\bbefore the workflow detail\b/i;
const audienceFramingSlidePattern =
	/\b(audience|who this is for|framing|leadership|executive)\b/i;
const workflowSlidePattern =
	/\b(workflow|prompt to candidate|review and generate|build offline|operator flow)\b/i;
const technicalJargonPatterns = [
	/\bcanonical\b/i,
	/\bschema\b/i,
	/\bdeterministic\b/i,
	/\bartifact\b/i,
	/\bmanifest\b/i,
	/\brenderer\b/i,
	/\bvalidation\b/i,
	/\bcontract\b/i,
] as const;

const promptCountWordMap = new Map<string, number>([
	["one", 1],
	["two", 2],
	["three", 3],
]);

export function hasPlaceholderText(content: string): boolean {
	const normalizedContent = content.trim();
	return (
		normalizedContent.length === 0 ||
		placeholderTextPatterns.some((pattern) => pattern.test(normalizedContent))
	);
}

export function collectPlaceholderTextAssetIds(
	textAssets: readonly TextAsset[],
): string[] {
	return textAssets.flatMap((asset) => {
		const content = flattenTextAssetContent(asset);
		return hasPlaceholderText(content) ? [asset.asset_id] : [];
	});
}

function flattenTextAssetContent(asset: TextAsset): string {
	return asset.text_kind === "bullet_list"
		? asset.content.join("\n")
		: asset.content;
}

function isShortFormTextAsset(asset: TextAsset): boolean {
	return (
		shortFormAssetPattern.test(asset.asset_id) ||
		shortFormAssetPattern.test(asset.asset_label)
	);
}

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function findTextAssetSlideIds(plan: DeckSpec, assetId: string): string[] {
	return uniqueStrings(
		plan.slide_mapping.flatMap((mapping) =>
			mapping.text_asset_ids.includes(assetId) ? [mapping.slide_id] : [],
		),
	);
}

function buildTextAssetMap(plan: DeckSpec): Map<string, TextAsset> {
	return new Map(
		plan.asset_manifest.text_assets.map((asset) => [asset.asset_id, asset]),
	);
}

function buildSlideCorpus(plan: DeckSpec, slideId: string): string {
	const textAssetsById = buildTextAssetMap(plan);
	const slide = plan.slides.find((item) => item.slide_id === slideId);
	const mapping = plan.slide_mapping.find((item) => item.slide_id === slideId);
	const mappedText = (mapping?.text_asset_ids ?? [])
		.map((assetId) => textAssetsById.get(assetId))
		.flatMap((asset) => (asset ? [flattenTextAssetContent(asset)] : []));

	return [slide?.title ?? "", ...(slide?.objectives ?? []), ...mappedText].join(
		" ",
	);
}

function collectTechnicalSlideIds(plan: DeckSpec): string[] {
	return plan.slides.flatMap((slide) => {
		const corpus = buildSlideCorpus(plan, slide.slide_id);
		const technicalHits = technicalJargonPatterns.filter((pattern) =>
			pattern.test(corpus),
		).length;
		return technicalHits >= 2 ? [slide.slide_id] : [];
	});
}

function collectReferencedVisualAssetIds(plan: DeckSpec): {
	image: Set<string>;
	shared: Set<string>;
} {
	const image = new Set<string>();
	const shared = new Set<string>();

	for (const slide of plan.slides) {
		for (const block of slide.content_blocks) {
			if (block.block_type !== "image") {
				continue;
			}

			if ("image_asset_id" in block) {
				image.add(block.image_asset_id);
				continue;
			}

			shared.add(block.shared_asset_id);
		}
	}

	return {
		image,
		shared,
	};
}

function collectMissingRequiredVisualAssetIds(plan: DeckSpec): string[] {
	const referencedAssetIds = collectReferencedVisualAssetIds(plan);
	const slideMappingsById = new Map(
		plan.slide_mapping.map((mapping) => [mapping.slide_id, mapping]),
	);
	const missingImageAssetIds = plan.asset_manifest.image_assets.flatMap(
		(asset) => {
			if (!asset.required) {
				return [];
			}

			const mapping = slideMappingsById.get(asset.slide_id);
			const mapped = mapping?.image_asset_ids.includes(asset.asset_id) ?? false;
			const referenced = referencedAssetIds.image.has(asset.asset_id);
			return mapped && referenced ? [] : [asset.asset_id];
		},
	);
	const missingSharedAssetIds = plan.asset_manifest.shared_assets.flatMap(
		(asset) => {
			if (!asset.required) {
				return [];
			}

			const mapped = plan.slide_mapping.some((mapping) =>
				mapping.shared_asset_ids.includes(asset.asset_id),
			);
			const referenced = referencedAssetIds.shared.has(asset.asset_id);
			return mapped && referenced ? [] : [asset.asset_id];
		},
	);

	return uniqueStrings([...missingImageAssetIds, ...missingSharedAssetIds]);
}

function requiresExecutiveAudienceTone(sourcePrompt: string): boolean {
	return executiveAudiencePattern.test(sourcePrompt);
}

function parseAudienceFramingSlideCount(sourcePrompt: string): number {
	const match = sourcePrompt.match(audienceFramingPromptCountPattern);
	if (!match) {
		return audienceFramingPromptPattern.test(sourcePrompt) &&
			workflowDetailPromptPattern.test(sourcePrompt)
			? 1
			: 0;
	}

	const rawCount = match[1]?.toLowerCase() ?? "1";
	return (promptCountWordMap.get(rawCount) ?? Number(rawCount)) || 1;
}

function countAudienceFramingSlidesBeforeWorkflow(plan: DeckSpec): number {
	const workflowSlideIndex = plan.slides.findIndex((slide) =>
		workflowSlidePattern.test([slide.title, ...slide.objectives].join(" ")),
	);
	const workflowBoundary =
		workflowSlideIndex === -1 ? plan.slides.length : workflowSlideIndex;

	return plan.slides.slice(0, workflowBoundary).filter((slide) =>
		audienceFramingSlidePattern.test([slide.title, ...slide.objectives].join(" ")),
	).length;
}

export function collectUnderdevelopedTextAssetIds(
	textAssets: readonly TextAsset[],
): string[] {
	return textAssets.flatMap((asset) => {
		if (hasPlaceholderText(flattenTextAssetContent(asset))) {
			return [];
		}

		if (asset.text_kind === "bullet_list") {
			return asset.content.length < 2 ? [asset.asset_id] : [];
		}

		if (isShortFormTextAsset(asset)) {
			return [];
		}

		return asset.content.trim().length < 40 ? [asset.asset_id] : [];
	});
}

export function collectMaterialQualitySignals(
	sourcePrompt: string,
	plan: DeckSpec,
): MaterialQualitySignal[] {
	const signals: MaterialQualitySignal[] = [];
	const placeholderAssetIds = collectPlaceholderTextAssetIds(
		plan.asset_manifest.text_assets,
	);
	if (placeholderAssetIds.length > 0) {
		signals.push({
			id: "placeholder_copy",
			severity: "warn",
			message: "Some text assets still contain placeholder deck copy.",
			related_slide_ids: uniqueStrings(
				placeholderAssetIds.flatMap((assetId) =>
					findTextAssetSlideIds(plan, assetId),
				),
			),
			related_asset_ids: placeholderAssetIds,
		});
	}

	const underdevelopedAssetIds = collectUnderdevelopedTextAssetIds(
		plan.asset_manifest.text_assets,
	);
	if (underdevelopedAssetIds.length > 0) {
		signals.push({
			id: "underdeveloped_copy",
			severity: "warn",
			message:
				"Some non-shortform text assets are still too thin for deck-ready copy.",
			related_slide_ids: uniqueStrings(
				underdevelopedAssetIds.flatMap((assetId) =>
					findTextAssetSlideIds(plan, assetId),
				),
			),
			related_asset_ids: underdevelopedAssetIds,
		});
	}

	const missingVisualAssetIds = collectMissingRequiredVisualAssetIds(plan);
	if (missingVisualAssetIds.length > 0) {
		signals.push({
			id: "missing_required_visual_mapping",
			severity: "fail",
			message:
				"One or more required image or shared assets are not fully mapped into slide content.",
			related_slide_ids: uniqueStrings(
				plan.slide_mapping.flatMap((mapping) =>
					missingVisualAssetIds.some(
						(assetId) =>
							mapping.image_asset_ids.includes(assetId) ||
							mapping.shared_asset_ids.includes(assetId),
					)
						? [mapping.slide_id]
						: [],
				),
			),
			related_asset_ids: missingVisualAssetIds,
		});
	}

	const requiredAudienceFramingSlides = parseAudienceFramingSlideCount(
		sourcePrompt,
	);
	if (
		requiredAudienceFramingSlides > 0 &&
		countAudienceFramingSlidesBeforeWorkflow(plan) <
			requiredAudienceFramingSlides
	) {
		signals.push({
			id: "explicit_audience_framing_missing",
			severity: "fail",
			message:
				requiredAudienceFramingSlides === 1
					? "The prompt asks for an explicit audience-framing slide before workflow detail, but the plan does not allocate one."
					: `The prompt asks for ${requiredAudienceFramingSlides} audience-framing slides before workflow detail, but the plan allocates fewer than that.`,
			related_slide_ids: [],
			related_asset_ids: [],
		});
	}

	if (requiresExecutiveAudienceTone(sourcePrompt)) {
		const technicalSlideIds = collectTechnicalSlideIds(plan);
		if (technicalSlideIds.length > 0) {
			signals.push({
				id: "audience_tone_drift",
				severity: "warn",
				message:
					"The prompt asks for a non-technical leadership tone, but the current deck copy remains heavily implementation-oriented.",
				related_slide_ids: technicalSlideIds,
				related_asset_ids: [],
			});
		}
	}

	return signals;
}
