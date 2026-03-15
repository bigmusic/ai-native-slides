import { describe, expect, it } from "vitest";

import { createDeterministicSemanticReview } from "../src/deck-spec-module/review-bridge/createSemanticReview.js";
import {
	collectMaterialQualitySignals,
	collectPlaceholderTextAssetIds,
	collectUnderdevelopedTextAssetIds,
	hasPlaceholderText,
} from "../src/deck-spec-module/reviewing/materialQuality.js";
import {
	classifyPromptQualitySignals,
	collectPromptQualitySignals,
	createReviewVisualPromptSummaries,
} from "../src/deck-spec-module/reviewing/promptQuality.js";
import {
	calculateOverallAverage,
	calculateSectionAverage,
	roundScoreAverage,
} from "../src/deck-spec-module/reviewing/scorecard.js";
import { validateSpecReviewDocument } from "../src/spec/validateSpecReview.js";
import {
	createDeckSpecScenario,
	loadDeckSpecBaselinePlan,
} from "./deckSpecScenarioFixtures.js";

describe("deck-spec-module reviewing", () => {
	it("calculates rounded section and overall averages deterministically", () => {
		const deckMaterialScorecard = {
			dimensions: [
				{
					id: "deliverable_alignment" as const,
					label: "Deliverable Alignment",
					score: 5,
					rationale: "Aligned.",
					related_slide_ids: [],
					related_asset_ids: [],
				},
				{
					id: "topic_coverage" as const,
					label: "Topic Coverage",
					score: 4,
					rationale: "Mostly aligned.",
					related_slide_ids: [],
					related_asset_ids: [],
				},
			],
			section_average: 0,
			overall_average: 0,
		};
		const imagePromptScorecard = {
			dimensions: [
				{
					id: "prompt_specificity" as const,
					label: "Prompt Specificity",
					score: 3,
					rationale: "Serviceable.",
					related_slide_ids: [],
					related_asset_ids: [],
				},
				{
					id: "visual_alignment" as const,
					label: "Visual Alignment",
					score: 4,
					rationale: "Aligned.",
					related_slide_ids: [],
					related_asset_ids: [],
				},
				{
					id: "generation_safety" as const,
					label: "Generation Safety",
					score: 5,
					rationale: "Safe.",
					related_slide_ids: [],
					related_asset_ids: [],
				},
			],
			section_average: 0,
			overall_average: 0,
		};

		expect(roundScoreAverage(3.333)).toBe(3.3);
		expect(calculateSectionAverage(deckMaterialScorecard.dimensions)).toBe(4.5);
		expect(calculateSectionAverage(imagePromptScorecard.dimensions)).toBe(4);
		expect(
			calculateOverallAverage(
				{
					...deckMaterialScorecard,
					section_average: calculateSectionAverage(
						deckMaterialScorecard.dimensions,
					),
				},
				{
					...imagePromptScorecard,
					section_average: calculateSectionAverage(
						imagePromptScorecard.dimensions,
					),
				},
			),
		).toBe(4.2);
	});

	it("flags placeholder deck copy deterministically", async () => {
		const plan = await loadDeckSpecBaselinePlan();
		const placeholderAssets = [
			...plan.asset_manifest.text_assets,
			{
				asset_id: "placeholder_card_body",
				asset_label: "Placeholder body",
				text_kind: "plain_text" as const,
				content: "TODO: write this later.",
				required: true,
				status: "planned" as const,
			},
		];

		expect(hasPlaceholderText("TODO: replace this.")).toBe(true);
		expect(hasPlaceholderText("Real deck-ready copy")).toBe(false);
		expect(collectPlaceholderTextAssetIds(placeholderAssets)).toContain(
			"placeholder_card_body",
		);
	});

	it("covers the semantic scenario matrix deterministically", async () => {
		for (const scenarioId of [
			"strong_plan_strong_prompts_pass",
			"weak_image_prompts_warn",
			"audience_tone_drift_warn",
			"missing_requirement_or_visual_fail",
			"unsafe_or_generic_prompt_warn_or_fail",
		] as const) {
			const scenario = await createDeckSpecScenario(scenarioId);
			const materialSignalIds = collectMaterialQualitySignals(
				scenario.source_prompt,
				scenario.plan,
			).map((signal) => signal.id);
			const promptSignalIds = scenario.plan.asset_manifest.image_assets.flatMap(
				(asset) =>
					classifyPromptQualitySignals(asset).map((signal) => signal.id),
			);

			expect(materialSignalIds).toEqual(
				expect.arrayContaining(scenario.expected_material_signal_ids),
			);
			expect(promptSignalIds).toEqual(
				expect.arrayContaining(scenario.expected_prompt_signal_ids),
			);

			const review = createDeterministicSemanticReview({
				...scenario.plan,
				source_prompt: scenario.source_prompt,
			});
			expect(review.status).toBe(scenario.expected_status);
			expect(
				validateSpecReviewDocument(review, {
					deckSpec: {
						...scenario.plan,
						source_prompt: scenario.source_prompt,
					},
				}).ok,
			).toBe(true);
		}
	});

	it("flags missing required visual mappings and underdeveloped copy deterministically", async () => {
		const plan = await loadDeckSpecBaselinePlan();
		const heroMessage = plan.asset_manifest.text_assets.find(
			(asset) => asset.asset_id === "hero_message",
		);
		if (!heroMessage || heroMessage.text_kind !== "plain_text") {
			throw new Error("Expected hero_message plain text fixture asset.");
		}
		heroMessage.content = "Too vague.";

		const heroSlide = plan.slides.find(
			(slide) => slide.slide_id === "overview_hero",
		);
		const heroMapping = plan.slide_mapping.find(
			(mapping) => mapping.slide_id === "overview_hero",
		);
		if (!heroSlide || !heroMapping) {
			throw new Error("Expected overview_hero slide mapping.");
		}
		heroSlide.content_blocks = heroSlide.content_blocks.filter(
			(block) =>
				!("image_asset_id" in block) ||
				block.image_asset_id !== "hero_visual_asset",
		);
		heroMapping.image_asset_ids = heroMapping.image_asset_ids.filter(
			(assetId) => assetId !== "hero_visual_asset",
		);

		expect(
			collectUnderdevelopedTextAssetIds(plan.asset_manifest.text_assets),
		).toContain("hero_message");
		expect(
			collectMaterialQualitySignals(plan.source_prompt, plan).map(
				(signal) => signal.id,
			),
		).toContain("missing_required_visual_mapping");
	});

	it("creates review visual prompt summaries with slot and objective context", async () => {
		const plan = await loadDeckSpecBaselinePlan();
		const summaries = createReviewVisualPromptSummaries(plan);
		const heroSummary = summaries.find(
			(summary) => summary.asset_id === "hero_visual_asset",
		);

		expect(heroSummary).toBeDefined();
		expect(heroSummary?.slide_id).toBe("overview_hero");
		expect(heroSummary?.referenced_layout_slots).toEqual(["hero_visual"]);
		expect(heroSummary?.slide_objectives[0]).toContain("planning");
		expect(heroSummary?.compiled_provider_prompt).toContain(
			'Scope: slide-scoped asset for slide "overview_hero".',
		);
		const heroAsset = plan.asset_manifest.image_assets[0];

		expect(heroAsset).toBeDefined();
		expect(collectPromptQualitySignals(heroAsset as typeof heroAsset)).toEqual(
			[],
		);
	});
});
