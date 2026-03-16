import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	type MaterialQualitySignal,
	type PromptQualitySignal,
	calculateOverallAverage,
	calculateSectionAverage,
	deckMaterialScoreDimensionSpecs,
	imagePromptScoreDimensionSpecs,
} from "../src/public-testing.js";
import type { DeckSpec, DeckSpecCandidate } from "../src/spec/contract.js";
import type {
	DeckMaterialScorecard,
	ImagePromptScorecard,
	SpecReviewResult,
} from "../src/spec/reviewContract.js";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const fixturePlanPath = path.join(
	projectRoot,
	"tests",
	"fixtures",
	"deck-spec.fixture.json",
);

export const deckSpecScenarioIds = [
	"strong_plan_strong_prompts_pass",
	"weak_image_prompts_warn",
	"audience_tone_drift_warn",
	"missing_requirement_or_visual_fail",
	"unsafe_or_generic_prompt_warn_or_fail",
] as const;
export type DeckSpecScenarioId = (typeof deckSpecScenarioIds)[number];

export type DeckSpecScenario = {
	id: DeckSpecScenarioId;
	expected_status: SpecReviewResult["status"];
	source_prompt: string;
	plan: DeckSpec;
	expected_material_signal_ids: string[];
	expected_prompt_signal_ids: string[];
	deck_material_score: number;
	image_prompt_score: number;
};

function clonePlan(plan: DeckSpec): DeckSpec {
	return structuredClone(plan);
}

function mutatePromptFixture(
	plan: DeckSpec,
	assetId: string,
	mutator: (asset: DeckSpec["asset_manifest"]["image_assets"][number]) => void,
): void {
	const asset = plan.asset_manifest.image_assets.find(
		(item) => item.asset_id === assetId,
	);
	if (!asset) {
		throw new Error(`Expected image asset "${assetId}" to exist.`);
	}

	mutator(asset);
}

export async function loadDeckSpecBaselinePlan(): Promise<DeckSpec> {
	return JSON.parse(await readFile(fixturePlanPath, "utf8")) as DeckSpec;
}

export function createPlanCandidateFromScenarioPlan(
	plan: DeckSpec,
): DeckSpecCandidate {
	const candidatePlan = clonePlan(plan) as DeckSpecCandidate;
	delete candidatePlan.source_prompt;
	delete candidatePlan.spec_version;
	delete candidatePlan.generated_at;
	delete candidatePlan.project_slug;
	candidatePlan.status = "reviewed";
	return candidatePlan;
}

export async function createDeckSpecScenario(
	scenarioId: DeckSpecScenarioId,
): Promise<DeckSpecScenario> {
	const baselinePlan = clonePlan(await loadDeckSpecBaselinePlan());

	switch (scenarioId) {
		case "strong_plan_strong_prompts_pass":
			return {
				id: scenarioId,
				expected_status: "pass",
				source_prompt: baselinePlan.source_prompt,
				plan: baselinePlan,
				expected_material_signal_ids: [],
				expected_prompt_signal_ids: [],
				deck_material_score: 5,
				image_prompt_score: 5,
			};
		case "weak_image_prompts_warn": {
			const scenarioPlan = clonePlan(baselinePlan);
			mutatePromptFixture(scenarioPlan, "hero_visual_asset", (asset) => {
				asset.subject = "workflow visual";
				asset.image_prompt_spec.composition = "workflow visual";
				asset.image_prompt_spec.color_direction = "blue";
				asset.image_prompt_spec.detail_cues = ["workflow"];
				asset.image_prompt_spec.avoid_elements = ["logos"];
			});
			return {
				id: scenarioId,
				expected_status: "warn",
				source_prompt: scenarioPlan.source_prompt,
				plan: scenarioPlan,
				expected_material_signal_ids: [],
				expected_prompt_signal_ids: [
					"weak_composition",
					"vague_color_direction",
					"sparse_detail_cues",
					"generic_subject",
				],
				deck_material_score: 5,
				image_prompt_score: 3,
			};
		}
		case "audience_tone_drift_warn": {
			const scenarioPlan = clonePlan(baselinePlan);
			return {
				id: scenarioId,
				expected_status: "warn",
				source_prompt:
					"Create a non-technical executive overview deck for leadership that uses plain business framing instead of implementation jargon.",
				plan: scenarioPlan,
				expected_material_signal_ids: ["audience_tone_drift"],
				expected_prompt_signal_ids: [],
				deck_material_score: 3,
				image_prompt_score: 5,
			};
		}
		case "missing_requirement_or_visual_fail": {
			const scenarioPlan = clonePlan(baselinePlan);
			return {
				id: scenarioId,
				expected_status: "fail",
				source_prompt:
					"Create a six-slide deck for operators that explicitly includes an audience framing slide before the workflow detail.",
				plan: scenarioPlan,
				expected_material_signal_ids: ["explicit_audience_framing_missing"],
				expected_prompt_signal_ids: [],
				deck_material_score: 1,
				image_prompt_score: 5,
			};
		}
		case "unsafe_or_generic_prompt_warn_or_fail": {
			const scenarioPlan = clonePlan(baselinePlan);
			mutatePromptFixture(scenarioPlan, "review_visual_asset", (asset) => {
				asset.subject = "diagram";
				asset.image_prompt_spec.composition = "diagram";
				asset.image_prompt_spec.color_direction = "blue";
				asset.image_prompt_spec.detail_cues = ["diagram"];
				asset.image_prompt_spec.avoid_elements = [];
			});
			return {
				id: scenarioId,
				expected_status: "fail",
				source_prompt: scenarioPlan.source_prompt,
				plan: scenarioPlan,
				expected_material_signal_ids: [],
				expected_prompt_signal_ids: [
					"weak_composition",
					"vague_color_direction",
					"sparse_detail_cues",
					"generic_subject",
					"missing_avoid_elements",
				],
				deck_material_score: 5,
				image_prompt_score: 1,
			};
		}
	}
}

function createDeckMaterialScorecard(
	score: number,
	rationale: string,
	relatedSlideIds: string[],
	relatedAssetIds: string[],
): DeckMaterialScorecard {
	const dimensions = deckMaterialScoreDimensionSpecs.map((spec) => ({
		id: spec.id,
		label: spec.label,
		score,
		rationale,
		related_slide_ids: [...relatedSlideIds],
		related_asset_ids: [...relatedAssetIds],
	}));

	return {
		dimensions,
		section_average: calculateSectionAverage(dimensions),
		overall_average: 0,
	};
}

function createImagePromptScorecard(
	score: number,
	rationale: string,
	relatedSlideIds: string[],
	relatedAssetIds: string[],
): ImagePromptScorecard {
	const dimensions = imagePromptScoreDimensionSpecs.map((spec) => ({
		id: spec.id,
		label: spec.label,
		score,
		rationale,
		related_slide_ids: [...relatedSlideIds],
		related_asset_ids: [...relatedAssetIds],
	}));

	return {
		dimensions,
		section_average: calculateSectionAverage(dimensions),
		overall_average: 0,
	};
}

function createFindingsFromSignals(
	status: SpecReviewResult["status"],
	materialSignals: MaterialQualitySignal[],
	promptSignals: PromptQualitySignal[],
): SpecReviewResult["findings"] {
	if (status === "pass") {
		return [
			{
				finding_id: "plan_alignment_confirmed",
				severity: "info",
				message:
					"The canonical spec and compiled prompts remain aligned with the requested deck outcome.",
				related_slide_ids: ["overview_hero"],
				related_asset_ids: ["hero_visual_asset"],
			},
		];
	}

	const evidenceSignals = [...materialSignals, ...promptSignals];
	return evidenceSignals.slice(0, 3).map((signal, index) => ({
		finding_id: `${signal.id}_${index + 1}`,
		severity: signal.severity === "fail" ? "error" : "warning",
		message: signal.message,
		related_slide_ids:
			signal.related_slide_ids.length > 0
				? [...signal.related_slide_ids]
				: ["overview_hero"],
		related_asset_ids: [...signal.related_asset_ids],
	}));
}

function createMissingRequirements(scenario: DeckSpecScenario): string[] {
	switch (scenario.id) {
		case "missing_requirement_or_visual_fail":
			return [
				"Add an explicit audience framing slide before the workflow detail.",
			];
		case "unsafe_or_generic_prompt_warn_or_fail":
			return [
				"Strengthen required image prompts so they include concrete composition and deck-safety constraints before generation.",
			];
		default:
			return [];
	}
}

export function createReviewCandidateForScenario(
	scenario: DeckSpecScenario,
	materialSignals: MaterialQualitySignal[],
	promptSignals: PromptQualitySignal[],
): SpecReviewResult {
	const deckRelatedSlideIds =
		materialSignals.flatMap((signal) => signal.related_slide_ids).length > 0
			? [
					...new Set(
						materialSignals.flatMap((signal) => signal.related_slide_ids),
					),
				]
			: ["overview_hero"];
	const deckRelatedAssetIds = [
		...new Set(materialSignals.flatMap((signal) => signal.related_asset_ids)),
	];
	const promptRelatedSlideIds =
		promptSignals.flatMap((signal) => signal.related_slide_ids).length > 0
			? [
					...new Set(
						promptSignals.flatMap((signal) => signal.related_slide_ids),
					),
				]
			: ["overview_hero"];
	const promptRelatedAssetIds =
		promptSignals.flatMap((signal) => signal.related_asset_ids).length > 0
			? [
					...new Set(
						promptSignals.flatMap((signal) => signal.related_asset_ids),
					),
				]
			: ["hero_visual_asset"];
	const deckRationale =
		materialSignals[0]?.message ??
		"Deck materials remain aligned with the requested deliverable.";
	const promptRationale =
		promptSignals[0]?.message ??
		"Image prompts remain specific, aligned, and deck-safe.";
	const deckMaterialScorecard = createDeckMaterialScorecard(
		scenario.deck_material_score,
		deckRationale,
		deckRelatedSlideIds,
		deckRelatedAssetIds,
	);
	const imagePromptScorecard = createImagePromptScorecard(
		scenario.image_prompt_score,
		promptRationale,
		promptRelatedSlideIds,
		promptRelatedAssetIds,
	);
	const overallAverage = calculateOverallAverage(
		deckMaterialScorecard,
		imagePromptScorecard,
	);

	return {
		status: scenario.expected_status,
		summary:
			scenario.expected_status === "pass"
				? "Semantic review found the deck spec and prompt set aligned."
				: scenario.expected_status === "warn"
					? "Semantic review found usable but drifted deck materials or prompt planning."
					: "Semantic review found a major prompt-alignment issue that blocks trust.",
		findings: createFindingsFromSignals(
			scenario.expected_status,
			materialSignals,
			promptSignals,
		),
		missing_requirements:
			scenario.expected_status === "fail"
				? createMissingRequirements(scenario)
				: [],
		drift_notes:
			scenario.expected_status === "warn"
				? [...materialSignals, ...promptSignals].map((signal) => signal.message)
				: [],
		recommended_actions:
			scenario.expected_status === "fail"
				? ["Revise the deck spec or prompt specs before downstream generation."]
				: scenario.expected_status === "warn"
					? [
							"Tighten the weak semantic areas before relying on downstream review.",
						]
					: ["Proceed to the next workflow step."],
		reviewed_at: "2026-03-14T20:19:00.000Z",
		deck_material_scorecard: {
			...deckMaterialScorecard,
			overall_average: overallAverage,
		},
		image_prompt_scorecard: {
			...imagePromptScorecard,
			overall_average: overallAverage,
		},
	};
}
