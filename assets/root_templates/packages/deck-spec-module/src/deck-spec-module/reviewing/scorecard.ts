import type {
	DeckMaterialScorecard,
	DeckMaterialScoreDimensionId,
	ImagePromptScorecard,
	ImagePromptScoreDimensionId,
	SpecReviewScorecard,
	SpecReviewScoreDimension,
} from "./reviewTypes.js";

export type ScoreDimensionSpec<DimensionId extends string> = {
	id: DimensionId;
	label: string;
	description: string;
};

export const deckMaterialScoreDimensionSpecs = [
	{
		id: "deliverable_alignment",
		label: "Deliverable Alignment",
		description:
			"How well the planned deck still matches the prompt's primary deliverable and framing.",
	},
	{
		id: "topic_coverage",
		label: "Topic Coverage",
		description:
			"How fully the planned slides and assets cover the prompt-explicit stages, topics, and requirements.",
	},
	{
		id: "audience_tone_fit",
		label: "Audience And Tone Fit",
		description:
			"How well the planned content density, framing, and tone fit the audience named by the prompt.",
	},
	{
		id: "narrative_allocation",
		label: "Narrative Allocation",
		description:
			"How well slide count, sequence, and emphasis are allocated across the requested story.",
	},
	{
		id: "asset_mapping_sufficiency",
		label: "Asset Mapping Sufficiency",
		description:
			"How well text and visual assets are mapped to slide roles, slots, and objectives.",
	},
] as const satisfies readonly ScoreDimensionSpec<DeckMaterialScoreDimensionId>[];

export const imagePromptScoreDimensionSpecs = [
	{
		id: "prompt_specificity",
		label: "Prompt Specificity",
		description:
			"How concrete and directed the planner-owned image prompt spec is for visual generation.",
	},
	{
		id: "visual_alignment",
		label: "Visual Alignment",
		description:
			"How well the planned visual prompt aligns with the slide's objective, usage, and slot role.",
	},
	{
		id: "generation_safety",
		label: "Generation Safety",
		description:
			"How well the prompt avoids unwanted text, logos, UI chrome, or other deck-breaking artifacts.",
	},
] as const satisfies readonly ScoreDimensionSpec<ImagePromptScoreDimensionId>[];

export function roundScoreAverage(value: number): number {
	return Math.round(value * 10) / 10;
}

export function calculateSectionAverage<DimensionId extends string>(
	dimensions: readonly SpecReviewScoreDimension<DimensionId>[],
): number {
	if (dimensions.length === 0) {
		return 0;
	}

	const total = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
	return roundScoreAverage(total / dimensions.length);
}

export function calculateOverallAverage(
	deckMaterialScorecard: DeckMaterialScorecard,
	imagePromptScorecard: ImagePromptScorecard,
): number {
	const allDimensions = [
		...deckMaterialScorecard.dimensions,
		...imagePromptScorecard.dimensions,
	];
	return calculateSectionAverage(allDimensions);
}

export function scorecardDimensionIds<DimensionId extends string>(
	scorecard: SpecReviewScorecard<DimensionId>,
): DimensionId[] {
	return scorecard.dimensions.map((dimension) => dimension.id);
}

export function hasCanonicalDimensionOrder<DimensionId extends string>(
	scorecard: SpecReviewScorecard<DimensionId>,
	specs: readonly ScoreDimensionSpec<DimensionId>[],
): boolean {
	return (
		JSON.stringify(scorecardDimensionIds(scorecard)) ===
		JSON.stringify(specs.map((spec) => spec.id))
	);
}

export function hasCanonicalDimensionLabels<DimensionId extends string>(
	scorecard: SpecReviewScorecard<DimensionId>,
	specs: readonly ScoreDimensionSpec<DimensionId>[],
): boolean {
	return scorecard.dimensions.every(
		(dimension, index) => dimension.label === specs[index]?.label,
	);
}
