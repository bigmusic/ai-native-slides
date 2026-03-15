export const specReviewStatusValues = ["pass", "warn", "fail"] as const;
export type SpecReviewStatus = (typeof specReviewStatusValues)[number];

export const specReviewFindingSeverityValues = [
	"info",
	"warning",
	"error",
] as const;
export type SpecReviewFindingSeverity =
	(typeof specReviewFindingSeverityValues)[number];

export type SpecReviewFinding = {
	finding_id: string;
	severity: SpecReviewFindingSeverity;
	message: string;
	related_slide_ids: string[];
	related_asset_ids: string[];
};

export const deckMaterialScoreDimensionIds = [
	"deliverable_alignment",
	"topic_coverage",
	"audience_tone_fit",
	"narrative_allocation",
	"asset_mapping_sufficiency",
] as const;
export type DeckMaterialScoreDimensionId =
	(typeof deckMaterialScoreDimensionIds)[number];

export const imagePromptScoreDimensionIds = [
	"prompt_specificity",
	"visual_alignment",
	"generation_safety",
] as const;
export type ImagePromptScoreDimensionId =
	(typeof imagePromptScoreDimensionIds)[number];

export type SpecReviewScoreDimension<DimensionId extends string = string> = {
	id: DimensionId;
	label: string;
	score: number;
	rationale: string;
	related_slide_ids: string[];
	related_asset_ids: string[];
};

export type SpecReviewScorecard<DimensionId extends string = string> = {
	dimensions: SpecReviewScoreDimension<DimensionId>[];
	section_average: number;
	overall_average: number;
};

export type DeckMaterialScorecard =
	SpecReviewScorecard<DeckMaterialScoreDimensionId>;

export type ImagePromptScorecard =
	SpecReviewScorecard<ImagePromptScoreDimensionId>;

export type SpecReviewResult = {
	status: SpecReviewStatus;
	summary: string;
	findings: SpecReviewFinding[];
	missing_requirements: string[];
	drift_notes: string[];
	recommended_actions: string[];
	reviewed_at: string;
	deck_material_scorecard: DeckMaterialScorecard;
	image_prompt_scorecard: ImagePromptScorecard;
};
