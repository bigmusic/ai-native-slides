import path from "node:path";

import type {
	CanonicalSpecReviewSummary,
	ReviewBriefInput,
	ReviewSkillHandoff,
	ReviewSlideSummary,
} from "../planner-agent/planner-input.js";
import { createReviewVisualPromptSummaries } from "../planner-agent/prompt-quality.js";
import {
	renderReviewBriefMarkdown as renderReviewBriefMarkdownCore,
	reviewRubric,
	reviewStatusPolicy,
} from "../planner-agent/review-brief.js";
import {
	deckMaterialScoreDimensionSpecs,
	imagePromptScoreDimensionSpecs,
} from "../planner-agent/scorecard.js";
import type { DeckSpec, LayoutIntent } from "./contract.js";
import {
	resolveDeckSpecPath,
	resolveProjectDir,
	resolveReviewBriefPath,
	resolveReviewContextPath,
	resolveSpecReviewCandidatePath,
	resolveSpecReviewMarkdownPath,
	resolveSpecReviewPath,
} from "./readDeckSpec.js";

export type {
	CanonicalSpecReviewSummary,
	ReviewBriefInput,
	ReviewRubricCheck,
	ReviewSkillHandoff,
	ReviewSlideSummary,
	ReviewStatusPolicy,
	SpecReviewContextPaths,
} from "../planner-agent/planner-input.js";

export type ReviewContext = ReviewBriefInput & {
	project_slug: string;
};

export function createReviewSkillHandoff(
	projectDir: string,
): ReviewSkillHandoff {
	const resolvedProjectDir = resolveProjectDir(projectDir);

	return {
		actor: "codex_skill_agent",
		required_output_path: resolveSpecReviewCandidatePath(resolvedProjectDir),
		promotion_command: "pnpm spec:review",
		forbidden_mutations: ["spec/deck-spec.json", "output/", "media/"],
	};
}

function createReviewSlideSummary(plan: DeckSpec): ReviewSlideSummary[] {
	const slideMappings = new Map(
		plan.slide_mapping.map((mapping) => [mapping.slide_id, mapping]),
	);

	return plan.slides.map((slide) => {
		const mapping = slideMappings.get(slide.slide_id);

		return {
			slide_id: slide.slide_id,
			title: slide.title,
			layout_intent: slide.layout_intent as LayoutIntent,
			objectives: [...slide.objectives],
			text_asset_ids: [...(mapping?.text_asset_ids ?? [])],
			image_asset_ids: [...(mapping?.image_asset_ids ?? [])],
			shared_asset_ids: [...(mapping?.shared_asset_ids ?? [])],
		};
	});
}

export function createCanonicalSpecReviewSummary(
	plan: DeckSpec,
): CanonicalSpecReviewSummary {
	return {
		spec_status: plan.status,
		generated_at: plan.generated_at,
		slide_count: plan.slides.length,
		required_image_asset_count: plan.asset_manifest.image_assets.filter(
			(asset) => asset.required,
		).length,
		required_shared_asset_count: plan.asset_manifest.shared_assets.filter(
			(asset) => asset.required,
		).length,
		slides: createReviewSlideSummary(plan),
		visual_assets: createReviewVisualPromptSummaries(plan),
	};
}

export function createReviewContext(
	projectDir: string,
	plan: DeckSpec,
): ReviewContext {
	const resolvedProjectDir = resolveProjectDir(projectDir);

	return {
		source_prompt: plan.source_prompt,
		project_slug: path.basename(resolvedProjectDir),
		paths: {
			review_context_path: resolveReviewContextPath(resolvedProjectDir),
			review_brief_path: resolveReviewBriefPath(resolvedProjectDir),
			review_candidate_path: resolveSpecReviewCandidatePath(resolvedProjectDir),
			canonical_spec_path: resolveDeckSpecPath(resolvedProjectDir),
			promoted_review_json_path: resolveSpecReviewPath(resolvedProjectDir),
			promoted_review_markdown_path:
				resolveSpecReviewMarkdownPath(resolvedProjectDir),
		},
		skill_handoff: createReviewSkillHandoff(resolvedProjectDir),
		status_policy: reviewStatusPolicy.map((policy) => ({
			...policy,
			hard_requirements: [...policy.hard_requirements],
			common_examples: [...policy.common_examples],
		})),
		review_rubric: reviewRubric.map((check) => ({
			...check,
			fail_when: [...check.fail_when],
			warn_when: [...check.warn_when],
		})),
		canonical_spec_summary: createCanonicalSpecReviewSummary(plan),
		deck_material_dimensions: deckMaterialScoreDimensionSpecs,
		image_prompt_dimensions: imagePromptScoreDimensionSpecs,
	};
}

export function renderReviewBriefMarkdown(context: ReviewContext): string {
	return renderReviewBriefMarkdownCore(context);
}
