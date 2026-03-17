import { describe, expect, it, vi } from "vitest";
import deckSpecSchema from "../spec/deck-spec.schema.json" with {
	type: "json",
};

import {
	buildInitialPlannerPrompt,
	createDeterministicSemanticReview,
	planDeckSpecRun,
} from "../src/public-testing.js";
import type { DeckSpec, DeckSpecCandidate } from "../src/spec/contract.js";
import type { SpecReviewResult } from "../src/spec/reviewContract.js";
import { validateDeckSpecDocument } from "../src/spec/validateDeckSpec.js";
import {
	createPlanCandidateFromScenarioPlan,
	loadDeckSpecBaselinePlan,
} from "./deckSpecScenarioFixtures.js";

function expectReviewedCanonicalShape(deckSpec: DeckSpec): void {
	expect(deckSpec.spec_version).toBe("1.0.0");
	expect(deckSpec.status).toBe("reviewed");
	expect(deckSpec.target_slide_count).toBe(deckSpec.slides.length);
	expect(
		validateDeckSpecDocument(deckSpec, deckSpecSchema as object, {
			projectDir: "/virtual/test-project",
		}).ok,
	).toBe(true);
}

function createAudienceFramingCandidate(plan: DeckSpec): DeckSpecCandidate {
	const repairedPlan = structuredClone(plan);
	repairedPlan.slides.unshift({
		slide_id: "audience_framing",
		title: "Audience Framing",
		objectives: [
			"Clarify who this deck is for before the implementation sequence begins.",
			"Frame the material for operators and reviewers.",
		],
		layout_intent: "hero",
		content_blocks: [
			{
				block_id: "audience_badge_block",
				block_type: "badge",
				layout_slot: "eyebrow_badge",
				text_asset_id: "audience_badge",
			},
			{
				block_id: "audience_message_block",
				block_type: "text",
				layout_slot: "hero_message",
				text_asset_id: "audience_message",
			},
			{
				block_id: "audience_visual_block",
				block_type: "image",
				layout_slot: "hero_visual",
				image_asset_id: "audience_visual_asset",
			},
		],
		status: "planned",
	});
	repairedPlan.asset_manifest.text_assets.push(
		{
			asset_id: "audience_badge",
			asset_label: "Audience badge",
			text_kind: "plain_text",
			content: "Audience first",
			required: true,
			status: "planned",
		},
		{
			asset_id: "audience_message",
			asset_label: "Audience message",
			text_kind: "plain_text",
			content:
				"This deck is for operators who need the planning contract explained before the execution sequence begins.",
			required: true,
			status: "planned",
		},
	);
	repairedPlan.asset_manifest.image_assets.push({
		asset_id: "audience_visual_asset",
		asset_label: "Audience framing visual",
		slide_id: "audience_framing",
		intended_usage: "hero_visual",
		size_tier: "large",
		style: "editorial presentation illustration",
		subject:
			"operators and reviewers aligning on the deck contract before workflow execution",
		aspect_ratio: "16:9",
		image_prompt_spec: {
			composition:
				"Use a clear focal point that shows the intended audience aligning around a planning contract before execution details.",
			color_direction:
				"Use restrained corporate blues with warm neutral highlights and teal accents.",
			detail_cues: [
				"clear human focal point",
				"presentation-ready simplicity",
				"structured meeting context",
			],
			avoid_elements: ["logos", "tiny unreadable text", "UI chrome"],
		},
		output_format: "png",
		required: true,
		output_file_name: "audience_framing__hero_visual__large.png",
		status: "planned",
	});
	repairedPlan.slide_mapping.unshift({
		slide_id: "audience_framing",
		text_asset_ids: ["audience_badge", "audience_message"],
		image_asset_ids: ["audience_visual_asset"],
		shared_asset_ids: [],
	});
	repairedPlan.target_slide_count = repairedPlan.slides.length;

	return createPlanCandidateFromScenarioPlan(repairedPlan);
}

function createContractDriftCandidate(plan: DeckSpec): DeckSpecCandidate {
	const driftedCandidate = createPlanCandidateFromScenarioPlan(plan);
	const firstImageAsset = driftedCandidate.asset_manifest.image_assets[0];
	if (firstImageAsset) {
		delete (firstImageAsset as { image_prompt_spec?: unknown }).image_prompt_spec;
	}
	return driftedCandidate;
}

function createForcedPassingReview(deckSpec: DeckSpec): SpecReviewResult {
	const review = createDeterministicSemanticReview(deckSpec);
	return {
		...review,
		status: "pass",
		summary: "Injected semantic review accepted the canonical deck spec.",
		missing_requirements: [],
		drift_notes: [],
		recommended_actions: ["Proceed to publish."],
	};
}

function createPromptSafetyDriftCandidate(plan: DeckSpec): DeckSpecCandidate {
	const driftedCandidate = createPlanCandidateFromScenarioPlan(plan);
	for (const asset of driftedCandidate.asset_manifest.image_assets.slice(0, 2)) {
		asset.image_prompt_spec.avoid_elements = [];
	}
	return driftedCandidate;
}

describe("deck-spec planning seam", () => {
	it("includes a canonical JSON example in the planner prompt so model output stays on-contract", () => {
		const prompt = buildInitialPlannerPrompt(
			"Create a six-slide deck about canonical spec planning.",
		);

		expect(prompt).toContain("## Canonical JSON Shape Example");
		expect(prompt).toContain('"block_type": "badge"');
		expect(prompt).toContain('"text_kind": "plain_text"');
		expect(prompt).toContain('"text_kind": "bullet_list"');
		expect(prompt).toContain('"image_prompt_spec"');
		expect(prompt).toContain('"shared_assets": []');
		expect(prompt).toContain("Do not use generic aliases");
		expect(prompt).toContain(
			"Do not collapse `card`, `metric`, or timeline step blocks",
		);
		expect(prompt).toContain('"title_asset_id"');
		expect(prompt).toContain('"body_asset_id"');
		expect(prompt).toContain('"value_asset_id"');
		expect(prompt).toContain('"label_asset_id"');
	});

	it("accepts injected generator and semantic-review seams for a primary-pass run", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const generateDeckSpecCandidate = vi.fn(async () =>
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);
		const createSemanticReview = vi.fn((deckSpec: DeckSpec) =>
			createForcedPassingReview(deckSpec),
		);

		const result = await planDeckSpecRun(
			"Create a six-slide deck about canonical spec planning, semantic review, and deterministic publishing.",
			{
				projectSlug: "test-project",
				apiKey: "test-key",
			},
			{
				generateDeckSpecCandidate,
				createSemanticReview,
			},
		);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected a successful planDeckSpecRun result.");
		}

		expect(generateDeckSpecCandidate).toHaveBeenCalledTimes(1);
		expect(createSemanticReview).toHaveBeenCalledTimes(1);
		expect(result.diagnostics.used_fallback).toBe(false);
		expectReviewedCanonicalShape(result.deckSpec);
	});

	it("uses injected prompt builders across the primary and repair attempts", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const prompt =
			"Create a six-slide deck for operators that explicitly includes an audience framing slide before the workflow detail.";
		const generateDeckSpecCandidate = vi
			.fn()
			.mockImplementationOnce(async ({ prompt: compiledPrompt }) => {
				expect(compiledPrompt).toBe(`INITIAL::${prompt}`);
				return createPlanCandidateFromScenarioPlan(baselinePlan);
			})
			.mockImplementationOnce(async ({ prompt: compiledPrompt }) => {
				expect(compiledPrompt).toBe(`REPAIR::${prompt}`);
				return createAudienceFramingCandidate(baselinePlan);
			});

		const result = await planDeckSpecRun(
			prompt,
			{
				projectSlug: "test-project",
				apiKey: "test-key",
			},
			{
				generateDeckSpecCandidate,
				buildInitialPlannerPrompt: (sourcePrompt) => `INITIAL::${sourcePrompt}`,
				buildRepairPlannerPrompt: ({ sourcePrompt }) =>
					`REPAIR::${sourcePrompt}`,
			},
		);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected a successful fallback planDeckSpecRun result.");
		}

		expect(generateDeckSpecCandidate).toHaveBeenCalledTimes(2);
		expect(result.diagnostics.used_fallback).toBe(true);
		expect(result.attempts).toHaveLength(2);
		expect(result.deckSpec.slides[0]?.slide_id).toBe("audience_framing");
		expectReviewedCanonicalShape(result.deckSpec);
	});

	it("returns contract_validation_failed after two validation failures", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const malformedCandidate = createContractDriftCandidate(baselinePlan);
		const generateDeckSpecCandidate = vi
			.fn()
			.mockResolvedValueOnce(structuredClone(malformedCandidate))
			.mockResolvedValueOnce(structuredClone(malformedCandidate));

		const result = await planDeckSpecRun(
			"Create a six-slide deck about canonical spec planning with strict image prompt requirements.",
			{
				projectSlug: "test-project",
				apiKey: "test-key",
			},
			{
				generateDeckSpecCandidate,
			},
		);

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("Expected a failed planDeckSpecRun result.");
		}

		expect(result.error.code).toBe("contract_validation_failed");
		expect(result.diagnostics.used_fallback).toBe(true);
		expect(result.diagnostics.attempts).toEqual([
			expect.objectContaining({
				stage: "validation",
				status: "failed",
			}),
			expect.objectContaining({
				stage: "validation",
				status: "failed",
			}),
		]);
	});

	it("repairs empty avoid-elements arrays before semantic review runs", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const result = await planDeckSpecRun(
			"Create a six-slide deck about canonical spec planning with presentation-safe image prompts.",
			{
				projectSlug: "test-project",
				apiKey: "test-key",
			},
			{
				generateDeckSpecCandidate: async () =>
					createPromptSafetyDriftCandidate(baselinePlan),
			},
		);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected empty avoid-elements arrays to be normalized.");
		}

		expect(
			result.deckSpec.asset_manifest.image_assets[0]?.image_prompt_spec
				.avoid_elements,
		).toEqual([
			"logos",
			"tiny unreadable text",
			"UI chrome",
			"watermarks",
		]);
		expect(result.review.status).not.toBe("fail");
		expect(result.diagnostics.used_fallback).toBe(false);
	});

	it("returns semantic_review_failed after the repair attempt still fails review", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const generateDeckSpecCandidate = vi
			.fn()
			.mockResolvedValueOnce(createPlanCandidateFromScenarioPlan(baselinePlan))
			.mockResolvedValueOnce(createAudienceFramingCandidate(baselinePlan));

		const result = await planDeckSpecRun(
			"Create a six-slide deck for operators that explicitly includes two audience framing slides before the workflow detail.",
			{
				projectSlug: "test-project",
				apiKey: "test-key",
			},
			{
				generateDeckSpecCandidate,
			},
		);

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("Expected a failed planDeckSpecRun result.");
		}

		expect(result.error.code).toBe("semantic_review_failed");
		expect(result.diagnostics.used_fallback).toBe(true);
		expect(result.diagnostics.attempts).toEqual([
			expect.objectContaining({
				stage: "semantic_review",
				status: "failed",
			}),
			expect.objectContaining({
				stage: "semantic_review",
				status: "failed",
			}),
		]);
	});

	it("wraps unexpected generator failures as planning_failed", async () => {
		const result = await planDeckSpecRun(
			"Create a six-slide deck about canonical spec planning, semantic review, and deterministic publishing.",
			{
				projectSlug: "test-project",
				apiKey: "test-key",
			},
			{
				generateDeckSpecCandidate: async () => {
					throw new Error("mock planner failure");
				},
			},
		);

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("Expected a failed planDeckSpecRun result.");
		}

		expect(result.error.code).toBe("planning_failed");
		expect(result.error.message).toBe("mock planner failure");
	});

	it("rejects underspecified prompts before any planning attempt starts", async () => {
		const result = await planDeckSpecRun("Too short", {
			projectSlug: "test-project",
			apiKey: "test-key",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("Expected a failed planDeckSpecRun result.");
		}

		expect(result.error.code).toBe("prompt_invalid");
		expect(result.attempts).toEqual([]);
	});

	it("requires explicit projectSlug and apiKey instead of reading shell state", async () => {
		const missingProjectSlug = await planDeckSpecRun(
			"Create a six-slide deck about canonical spec planning, semantic review, and deterministic publishing.",
			{
				projectSlug: "",
				apiKey: "test-key",
			},
		);
		const missingApiKey = await planDeckSpecRun(
			"Create a six-slide deck about canonical spec planning, semantic review, and deterministic publishing.",
			{
				projectSlug: "test-project",
				apiKey: "",
			},
		);

		expect(missingProjectSlug.ok).toBe(false);
		expect(missingApiKey.ok).toBe(false);
		if (missingProjectSlug.ok || missingApiKey.ok) {
			throw new Error("Expected failed planDeckSpecRun results.");
		}

		expect(missingProjectSlug.error.message).toBe(
			"Missing projectSlug. Pass projectSlug in options.",
		);
		expect(missingApiKey.error.message).toBe(
			"Missing GEMINI_API_KEY. Pass apiKey in options.",
		);
	});
});
