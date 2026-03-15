import { reviewMaterialGuidance } from "./material-quality.js";
import type {
	ReviewBriefInput,
	ReviewRubricCheck,
	ReviewStatusPolicy,
} from "./planner-input.js";
import type {
	DeckMaterialScoreDimensionId,
	ImagePromptScoreDimensionId,
} from "./planner-output.js";
import { reviewPromptGuidance } from "./prompt-quality.js";
import type { ScoreDimensionSpec } from "./scorecard.js";

export const reviewStatusPolicy: ReviewStatusPolicy[] = [
	{
		status: "pass",
		description:
			"Use PASS only when all important prompt requirements are covered and the spec plus its image prompts have no material prompt drift.",
		hard_requirements: [
			"`missing_requirements` must be empty.",
			"`drift_notes` must be empty.",
			"Every finding must use severity `info`.",
		],
		common_examples: [
			"The spec covers every explicitly requested workflow stage or topic.",
			"The deck goal, deliverable shape, and required visuals remain aligned with the prompt.",
		],
	},
	{
		status: "warn",
		description:
			"Use WARN when the spec is mostly aligned but has emphasis drift, weak visual prompting, or storytelling mismatch that should be fixed before trust.",
		hard_requirements: [
			"`missing_requirements` must be empty.",
			"Include at least one `warning` finding or one `drift_note`.",
			"Do not use severity `error` in a WARN review.",
		],
		common_examples: [
			"A prompt topic is present but under-emphasized compared with the rest of the deck.",
			"The image prompts are usable but still too generic for the slot role or deck intent.",
		],
	},
	{
		status: "fail",
		description:
			"Use FAIL when the spec omits or contradicts an important prompt requirement, or when the specified slides or prompts cannot support the core deliverable.",
		hard_requirements: [
			"Include at least one `missing_requirement` or one severity `error` finding.",
			"Keep the summary and recommended actions specific enough for a rewrite.",
		],
		common_examples: [
			"A major workflow stage, audience framing, or explicit visual expectation from the prompt is missing.",
			"The planned slides or visual prompts make the requested deck outcome impossible to deliver faithfully.",
		],
	},
];

export const reviewRubric: ReviewRubricCheck[] = [
	{
		check_id: "deck_goal_and_deliverable",
		title: "Deck Goal And Deliverable",
		instruction:
			"Compare the prompt's primary deliverable and deck goal against the current canonical spec.",
		fail_when: [
			"The core deliverable is missing, contradicted, or replaced by a different deck purpose.",
			"The spec cannot plausibly produce the deck outcome requested in the prompt.",
		],
		warn_when: [
			"The core deliverable exists but is under-developed or framed too weakly.",
			"The deck goal is present but the emphasis is skewed away from the requested intent.",
		],
	},
	{
		check_id: "explicit_topics_and_stages",
		title: "Explicit Workflow Stages Or Topics",
		instruction:
			"Check whether every prompt-explicit workflow stage, topic, or operator step is represented clearly in the canonical spec.",
		fail_when: [
			"One or more important prompt-explicit stages or topics are absent.",
			"A requested stage is replaced with an unrelated topic.",
		],
		warn_when: [
			"A requested stage or topic appears, but receives obviously too little coverage or weak mapping to slides/assets.",
		],
	},
	{
		check_id: "explicit_audience_and_tone",
		title: "Explicit Audience And Tone",
		instruction:
			"Only if the prompt names an audience or tone, verify that the canonical spec reflects it in slide framing and content density.",
		fail_when: [
			"The prompt names an audience or tone and the canonical spec clearly ignores or contradicts it.",
		],
		warn_when: [
			"The audience or tone is partially reflected, but the slide framing still leans the wrong way.",
		],
	},
	{
		check_id: "narrative_allocation",
		title: "Slide Allocation And Narrative Emphasis",
		instruction:
			"Review whether slide count, sequence, and relative emphasis match the prompt's priorities.",
		fail_when: [
			"A major requirement cannot be covered because the slide plan allocates space to the wrong things.",
		],
		warn_when: [
			"The deck is broadly aligned but the weighting across slides is noticeably off.",
			"The sequencing is workable but introduces avoidable prompt drift.",
		],
	},
	{
		check_id: "visual_and_asset_sufficiency",
		title: "Required Visuals And Asset Sufficiency",
		instruction:
			"Check whether the required image/shared assets declared in the spec are sufficient for the visuals the prompt implies or explicitly requests.",
		fail_when: [
			"An explicit visual expectation has no supporting declared asset.",
			"The media plan makes the requested visual storytelling impossible or obviously off-prompt.",
		],
		warn_when: [
			"The right visuals are implied, but the asset coverage or usage is too thin or weakly targeted.",
		],
	},
	{
		check_id: "compiled_prompt_quality",
		title: "Compiled Prompt Quality",
		instruction:
			"Review whether the planner-owned image prompt specs and compiled provider prompts are specific, aligned, and deck-safe.",
		fail_when: [
			"A required visual prompt is so generic or unsafe that it cannot plausibly produce the requested visual role.",
		],
		warn_when: [
			"The prompt is directionally correct but still weak for the slot role, subject focus, or deck-safe output quality.",
		],
	},
];

function renderBulletList(
	items: readonly string[],
	noneLabel = "None.",
): string {
	if (items.length === 0) {
		return `- ${noneLabel}`;
	}

	return items.map((item) => `- ${item}`).join("\n");
}

function formatAssetIdList(assetIds: string[]): string {
	return assetIds.length === 0 ? "None." : assetIds.join(", ");
}

function renderStatusPolicyMarkdown(policy: ReviewStatusPolicy[]): string {
	return policy
		.map((entry) =>
			[
				`### \`${entry.status}\``,
				`- ${entry.description}`,
				"- Hard requirements:",
				renderBulletList(entry.hard_requirements),
				"- Common examples:",
				renderBulletList(entry.common_examples),
			].join("\n"),
		)
		.join("\n\n");
}

function renderReviewRubricMarkdown(checks: ReviewRubricCheck[]): string {
	return checks
		.map((check) =>
			[
				`### \`${check.check_id}\``,
				`- ${check.title}`,
				`- Review instruction: ${check.instruction}`,
				"- FAIL when:",
				renderBulletList(check.fail_when),
				"- WARN when:",
				renderBulletList(check.warn_when),
			].join("\n"),
		)
		.join("\n\n");
}

function renderScoreDimensionMarkdown<DimensionId extends string>(
	title: string,
	specs: readonly ScoreDimensionSpec<DimensionId>[],
): string {
	return [
		`### ${title}`,
		"- Each `score` must be an integer from `0` to `5`.",
		"- Every dimension must include a non-empty `rationale` plus related slide/asset ids when relevant.",
		...specs.map(
			(spec) => `- \`${spec.id}\` (${spec.label}): ${spec.description}`,
		),
	].join("\n");
}

function renderCanonicalSpecSummaryMarkdown(
	summary: ReviewBriefInput["canonical_spec_summary"],
): string {
	const slideSections = summary.slides.map((slide) =>
		[
			`### \`${slide.slide_id}\``,
			`- Title: ${slide.title}`,
			`- Layout: \`${slide.layout_intent}\``,
			"- Objectives:",
			renderBulletList(slide.objectives),
			`- Text assets: ${formatAssetIdList(slide.text_asset_ids)}`,
			`- Image assets: ${formatAssetIdList(slide.image_asset_ids)}`,
			`- Shared assets: ${formatAssetIdList(slide.shared_asset_ids)}`,
		].join("\n"),
	);

	const visualAssetSections = summary.visual_assets.map((asset) =>
		[
			`### \`${asset.asset_id}\``,
			`- Label: ${asset.asset_label}`,
			`- Scope: ${asset.asset_kind === "image" && asset.slide_id ? `slide \`${asset.slide_id}\`` : "deck scope"}`,
			`- Usage: \`${asset.intended_usage}\``,
			`- Size tier: \`${asset.size_tier}\``,
			`- Required: ${asset.required ? "yes" : "no"}`,
			`- Referenced slots: ${asset.referenced_layout_slots.length > 0 ? asset.referenced_layout_slots.join(", ") : "None."}`,
			"- Slide objectives:",
			renderBulletList(asset.slide_objectives),
			"- Prompt spec:",
			`- Composition: ${asset.image_prompt_spec.composition}`,
			`- Color direction: ${asset.image_prompt_spec.color_direction}`,
			`- Detail cues: ${asset.image_prompt_spec.detail_cues.join(", ")}`,
			`- Avoid elements: ${asset.image_prompt_spec.avoid_elements.join(", ")}`,
			"- Compiled provider prompt:",
			asset.compiled_provider_prompt
				.split("\n")
				.map((line) => `- ${line}`)
				.join("\n"),
		].join("\n"),
	);

	return [
		"## Current Canonical Spec",
		"",
		`- Status: \`${summary.spec_status}\``,
		`- Generated At: ${summary.generated_at}`,
		`- Slide count: ${summary.slide_count}`,
		`- Required image assets: ${summary.required_image_asset_count}`,
		`- Required shared assets: ${summary.required_shared_asset_count}`,
		"",
		"## Slide Summary",
		"",
		...slideSections,
		"",
		"## Visual Prompt Summary",
		"",
		visualAssetSections.length > 0
			? visualAssetSections.join("\n\n")
			: "- None.",
	].join("\n");
}

function renderScorecardInstructions(
	deckMaterialDimensions: readonly ScoreDimensionSpec<DeckMaterialScoreDimensionId>[],
	imagePromptDimensions: readonly ScoreDimensionSpec<ImagePromptScoreDimensionId>[],
): string {
	return [
		"## Scorecard Requirements",
		"",
		"- Include both `deck_material_scorecard` and `image_prompt_scorecard` in the review JSON.",
		"- Each scorecard must provide `dimensions`, `section_average`, and `overall_average`.",
		"- `section_average` must equal the rounded average of that scorecard's dimensions.",
		"- `overall_average` must be the same in both scorecards and equal the rounded average across all score dimensions.",
		"",
		renderScoreDimensionMarkdown(
			"Deck Material Dimensions",
			deckMaterialDimensions,
		),
		"",
		renderScoreDimensionMarkdown(
			"Image Prompt Dimensions",
			imagePromptDimensions,
		),
	].join("\n");
}

export function renderReviewBriefMarkdown(context: ReviewBriefInput): string {
	return [
		"# Review Brief",
		"",
		"## Task",
		"",
		`- Read the source prompt and the current canonical deck spec at \`${context.paths.canonical_spec_path}\`.`,
		`- Write a single JSON document to \`${context.paths.review_candidate_path}\`.`,
		"- Return JSON only. Do not wrap the response in markdown code fences.",
		"- Review prompt alignment only. Do not rerun structural validation or invent schema changes.",
		"- Review both the deck materials and the compiled image prompts for required visuals.",
		"- Treat important prompt requirements as the primary deliverable, prompt-explicit workflow stages/topics, explicit audience framing, and explicit visual expectations.",
		"",
		"## Canonical Prompt",
		"",
		context.source_prompt,
		"",
		"## Paths",
		"",
		`- Review context: \`${context.paths.review_context_path}\``,
		`- Review brief: \`${context.paths.review_brief_path}\``,
		`- Review candidate output: \`${context.paths.review_candidate_path}\``,
		`- Canonical spec: \`${context.paths.canonical_spec_path}\``,
		`- Promoted review JSON: \`${context.paths.promoted_review_json_path}\``,
		`- Promoted review Markdown: \`${context.paths.promoted_review_markdown_path}\``,
		"",
		"## Candidate JSON Shape",
		"",
		"- Top-level keys required in the JSON you write:",
		"- `status`",
		"- `summary`",
		"- `findings`",
		"- `missing_requirements`",
		"- `drift_notes`",
		"- `recommended_actions`",
		"- `reviewed_at`",
		"- `deck_material_scorecard`",
		"- `image_prompt_scorecard`",
		"- Each `findings[]` item must include `finding_id`, `severity`, `message`, `related_slide_ids`, and `related_asset_ids`.",
		"",
		"## Status Policy",
		"",
		renderStatusPolicyMarkdown(context.status_policy),
		"",
		"## Review Rubric",
		"",
		renderReviewRubricMarkdown(context.review_rubric),
		"",
		renderScorecardInstructions(
			context.deck_material_dimensions,
			context.image_prompt_dimensions,
		),
		"",
		"## Deck Material Review Guidance",
		"",
		renderBulletList(reviewMaterialGuidance),
		"",
		"## Image Prompt Review Guidance",
		"",
		renderBulletList(reviewPromptGuidance),
		"",
		renderCanonicalSpecSummaryMarkdown(context.canonical_spec_summary),
		"",
		"## Agent Execution Contract",
		"",
		`- Actor: \`${context.skill_handoff.actor}\``,
		`- Write JSON only to \`${context.skill_handoff.required_output_path}\`.`,
		`- After writing the review candidate, run \`${context.skill_handoff.promotion_command}\` from the project directory.`,
		`- Forbidden mutations while authoring the review candidate: ${context.skill_handoff.forbidden_mutations.map((value) => `\`${value}\``).join(", ")}.`,
		"- `pass` should mean the spec is ready to move forward semantically.",
		"- `warn` should mean the spec is usable but still needs alignment fixes before you fully trust it.",
		"- `fail` should block downstream media generation because the spec misses or contradicts important prompt requirements.",
		"- Scores explain the semantic quality judgment, but they do not override the status gate.",
		"",
		"## Final Output Rules",
		"",
		"- Write JSON only.",
		"- Do not include code fences.",
		"- Do not include commentary before or after the JSON.",
	].join("\n");
}
