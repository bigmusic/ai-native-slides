import type {
	AspectRatio,
	DeckImageAsset,
	DeckSpec,
	ImageIntendedUsage,
	ImagePromptSpec,
	SharedVisualAsset,
	SizeTier,
} from "../../spec/contract.js";

export type PlannedImageAsset = DeckImageAsset | SharedVisualAsset;

export type ReviewVisualPromptSummary = {
	asset_id: string;
	asset_label: string;
	asset_kind: "image" | "shared";
	intended_usage: ImageIntendedUsage;
	size_tier: SizeTier;
	required: boolean;
	slide_id?: string;
	referenced_layout_slots: string[];
	slide_objectives: string[];
	style: string;
	subject: string;
	aspect_ratio: AspectRatio;
	image_prompt_spec: ImagePromptSpec;
	compiled_provider_prompt: string;
};

export const promptQualitySignalSeverityValues = ["warn", "fail"] as const;
export type PromptQualitySignalSeverity =
	(typeof promptQualitySignalSeverityValues)[number];

export const promptQualitySignalIds = [
	"weak_composition",
	"vague_color_direction",
	"sparse_detail_cues",
	"generic_subject",
	"missing_avoid_elements",
	"missing_deck_safety_guardrail",
] as const;
export type PromptQualitySignalId = (typeof promptQualitySignalIds)[number];

export type PromptQualitySignal = {
	id: PromptQualitySignalId;
	severity: PromptQualitySignalSeverity;
	message: string;
	related_slide_ids: string[];
	related_asset_ids: string[];
};

export const plannerPromptAuthoringRules = [
	"Every required visual asset must be justified by slide objective, usage, and slot role.",
	"Keep image prompt specs concrete enough to produce a presentation-ready visual, not a generic wallpaper.",
	"Use avoid-elements guidance to explicitly block logos, UI chrome, and tiny unreadable text.",
] as const;

export const reviewPromptGuidance = [
	"Review both the planner-owned image_prompt_spec and the compiled provider prompt text.",
	"Treat weak specificity, off-role visuals, or unsafe generation cues as semantic prompt-quality issues.",
	"Reference the asset id and related slide id whenever a prompt-quality score needs justification.",
] as const;

function describeScope(asset: PlannedImageAsset): string {
	return "slide_id" in asset
		? `slide-scoped asset for slide "${asset.slide_id}"`
		: `deck-shared asset with scope "${asset.shared_scope}"`;
}

function describeUsage(asset: PlannedImageAsset): string {
	switch (asset.intended_usage) {
		case "hero_visual":
			return "Create a bold editorial hero image with a clear focal point.";
		case "background":
			return "Create a restrained full-frame background that stays non-distracting behind slide content.";
		case "diagram":
			return "Create a simplified diagram-style image with clean structure and legible visual grouping.";
		case "icon":
			return "Create a crisp icon-style visual with strong silhouette separation.";
		case "cutout":
			return "Create a cutout-style subject with strong subject isolation and minimal background noise.";
		default:
			return "Create a supporting visual that complements slide copy without overpowering it.";
	}
}

function relatedSlideIdsForAsset(asset: PlannedImageAsset): string[] {
	return "slide_id" in asset ? [asset.slide_id] : [];
}

function safetySignalSeverity(
	asset: PlannedImageAsset,
): PromptQualitySignalSeverity {
	return asset.required ? "fail" : "warn";
}

function hasGenericSubject(subject: string): boolean {
	const normalizedSubject = subject.trim().toLowerCase();
	const subjectWordCount = normalizedSubject.split(/\s+/).length;

	return (
		subjectWordCount <= 2 ||
		/^(image|visual|illustration|graphic|diagram|workflow visual|system diagram)$/.test(
			normalizedSubject,
		)
	);
}

export function compileProviderImagePrompt(asset: PlannedImageAsset): string {
	const detailCues = asset.image_prompt_spec.detail_cues.join(", ");
	const avoidElements = asset.image_prompt_spec.avoid_elements.join(", ");

	return [
		"Generate one presentation-ready image asset.",
		`Asset label: ${asset.asset_label}.`,
		`Scope: ${describeScope(asset)}.`,
		`Intended usage: ${asset.intended_usage}. ${describeUsage(asset)}`,
		`Style: ${asset.style}.`,
		`Subject: ${asset.subject}.`,
		`Aspect ratio: ${asset.aspect_ratio}.`,
		`Composition guidance: ${asset.image_prompt_spec.composition}.`,
		`Color direction: ${asset.image_prompt_spec.color_direction}.`,
		`Detail cues: ${detailCues}.`,
		`Avoid elements: ${avoidElements}.`,
		"Do not add logos, watermarks, UI chrome, or tiny unreadable text.",
	].join("\n");
}

export function classifyPromptQualitySignals(
	asset: PlannedImageAsset,
	compiledPrompt = compileProviderImagePrompt(asset),
): PromptQualitySignal[] {
	const signals: PromptQualitySignal[] = [];
	const related_slide_ids = relatedSlideIdsForAsset(asset);
	const related_asset_ids = [asset.asset_id];

	if (asset.image_prompt_spec.composition.trim().length < 20) {
		signals.push({
			id: "weak_composition",
			severity: "warn",
			message: "composition guidance is too thin",
			related_slide_ids,
			related_asset_ids,
		});
	}

	if (asset.image_prompt_spec.color_direction.trim().length < 10) {
		signals.push({
			id: "vague_color_direction",
			severity: "warn",
			message: "color direction is too vague",
			related_slide_ids,
			related_asset_ids,
		});
	}

	if (asset.image_prompt_spec.detail_cues.length < 2) {
		signals.push({
			id: "sparse_detail_cues",
			severity: "warn",
			message: "detail cues are too sparse",
			related_slide_ids,
			related_asset_ids,
		});
	}

	if (hasGenericSubject(asset.subject)) {
		signals.push({
			id: "generic_subject",
			severity: "warn",
			message: "subject is too generic for a presentation-grade prompt",
			related_slide_ids,
			related_asset_ids,
		});
	}

	if (asset.image_prompt_spec.avoid_elements.length === 0) {
		signals.push({
			id: "missing_avoid_elements",
			severity: safetySignalSeverity(asset),
			message: "avoid-elements guidance is missing",
			related_slide_ids,
			related_asset_ids,
		});
	}

	if (!compiledPrompt.includes("Do not add logos")) {
		signals.push({
			id: "missing_deck_safety_guardrail",
			severity: safetySignalSeverity(asset),
			message: "compiled prompt is missing the deck-safety guardrail",
			related_slide_ids,
			related_asset_ids,
		});
	}

	return signals;
}

export function collectPromptQualitySignals(
	asset: PlannedImageAsset,
	compiledPrompt = compileProviderImagePrompt(asset),
): string[] {
	return classifyPromptQualitySignals(asset, compiledPrompt).map(
		(signal) => signal.message,
	);
}

function findAssetSlots(plan: DeckSpec, assetId: string): string[] {
	return plan.slides.flatMap((slide) =>
		slide.content_blocks.flatMap((block) => {
			const imageAssetId =
				"image_asset_id" in block ? block.image_asset_id : undefined;
			const sharedAssetId =
				"shared_asset_id" in block ? block.shared_asset_id : undefined;
			return imageAssetId === assetId || sharedAssetId === assetId
				? [block.layout_slot]
				: [];
		}),
	);
}

function findSlideObjectives(
	plan: DeckSpec,
	asset: PlannedImageAsset,
): string[] {
	if (!("slide_id" in asset)) {
		return [];
	}

	return (
		plan.slides.find((slide) => slide.slide_id === asset.slide_id)
			?.objectives ?? []
	);
}

function createPromptSummary(
	plan: DeckSpec,
	asset: PlannedImageAsset,
): ReviewVisualPromptSummary {
	return {
		asset_id: asset.asset_id,
		asset_label: asset.asset_label,
		asset_kind: "slide_id" in asset ? "image" : "shared",
		intended_usage: asset.intended_usage,
		size_tier: asset.size_tier,
		required: asset.required,
		slide_id: "slide_id" in asset ? asset.slide_id : undefined,
		referenced_layout_slots: findAssetSlots(plan, asset.asset_id),
		slide_objectives: findSlideObjectives(plan, asset),
		style: asset.style,
		subject: asset.subject,
		aspect_ratio: asset.aspect_ratio,
		image_prompt_spec: {
			composition: asset.image_prompt_spec.composition,
			color_direction: asset.image_prompt_spec.color_direction,
			detail_cues: [...asset.image_prompt_spec.detail_cues],
			avoid_elements: [...asset.image_prompt_spec.avoid_elements],
		},
		compiled_provider_prompt: compileProviderImagePrompt(asset),
	};
}

export function createReviewVisualPromptSummaries(
	plan: DeckSpec,
): ReviewVisualPromptSummary[] {
	return [
		...plan.asset_manifest.image_assets.map((asset) =>
			createPromptSummary(plan, asset),
		),
		...plan.asset_manifest.shared_assets.map((asset) =>
			createPromptSummary(plan, asset),
		),
	];
}

export function hasUnsafePromptSignals(
	imagePromptSpec: ImagePromptSpec,
): boolean {
	return imagePromptSpec.avoid_elements.length === 0;
}
