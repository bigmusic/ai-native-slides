import {
	plannerMaterialAuthoringRules,
	reviewMaterialGuidance,
} from "./material-quality.js";
import type { PlannerBriefInput } from "./planner-input.js";
import { plannerPromptAuthoringRules } from "./prompt-quality.js";

function renderBulletList(
	items: readonly string[],
	noneLabel = "None.",
): string {
	if (items.length === 0) {
		return `- ${noneLabel}`;
	}

	return items.map((item) => `- ${item}`).join("\n");
}

function renderRendererContractMarkdown(
	rendererContract: PlannerBriefInput["renderer_contract"],
): string {
	return Object.entries(rendererContract)
		.map(([layoutIntent, slots]) => {
			const slotLines = Object.entries(slots).map(
				([slotName, slotContract]) =>
					`- \`${slotName}\`: ${slotContract.required ? "required" : "optional"}; allowed blocks: ${slotContract.allowedBlockTypes.map((value) => `\`${value}\``).join(", ")}`,
			);
			return [`### \`${layoutIntent}\``, ...slotLines].join("\n");
		})
		.join("\n\n");
}

function renderExistingSpecSummaryMarkdown(
	existingPlanSummary: PlannerBriefInput["existing_spec_summary"],
): string {
	if (!existingPlanSummary) {
		return "## Existing Canonical Spec\n\nNo valid canonical spec exists yet.\n";
	}

	const slideLines = existingPlanSummary.slides.map(
		(slide) =>
			`- \`${slide.slide_id}\`: ${slide.title} (\`${slide.layout_intent}\`)`,
	);

	return [
		"## Existing Canonical Spec",
		"",
		`- Status: \`${existingPlanSummary.spec_status}\``,
		`- Slide count: ${existingPlanSummary.slide_count}`,
		`- Required text assets: ${existingPlanSummary.required_text_asset_count}`,
		`- Required image assets: ${existingPlanSummary.required_image_asset_count}`,
		`- Required shared assets: ${existingPlanSummary.required_shared_asset_count}`,
		...slideLines,
	].join("\n");
}

export function renderPlannerBriefMarkdown(context: PlannerBriefInput): string {
	const warningSection =
		context.warnings && context.warnings.length > 0
			? [
					"## Warnings",
					"",
					...context.warnings.map((warning) => `- ${warning}`),
					"",
				].join("\n")
			: "";

	return [
		"# Legacy Planner Brief",
		"",
		"## Task",
		"",
		"- This brief exists only for the deprecated compatibility/debug workflow.",
		'- The main contract is `pnpm spec -- --prompt "<prompt>"`, which calls the deck-spec module directly and does not require manual candidate authoring.',
		`- Write a single JSON document to \`${context.paths.spec_candidate_path}\`.`,
		"- Return JSON only. Do not wrap the response in markdown code fences.",
		"- Produce only planner-owned fields. The workflow injects system-managed fields during promotion.",
		"- The candidate must be valid enough to promote into a canonical spec that passes the current validator and renderer contract.",
		"",
		"## Canonical Prompt",
		"",
		context.source_prompt,
		"",
		"## Paths",
		"",
		`- Planner context: \`${context.paths.planner_context_path}\``,
		`- Planner brief: \`${context.paths.planner_brief_path}\``,
		`- Candidate output: \`${context.paths.spec_candidate_path}\``,
		`- Canonical spec: \`${context.paths.canonical_spec_path}\``,
		`- Schema reference: \`${context.paths.deck_spec_schema_path}\``,
		"",
		"## Candidate JSON Shape",
		"",
		"- Top-level keys required in the JSON you write:",
		"- `target_slide_count`",
		"- `slides`",
		"- `asset_manifest`",
		"- `slide_mapping`",
		"- Each `slides[]` item must include `slide_id`, `title`, `objectives`, `layout_intent`, and `content_blocks`.",
		"- `asset_manifest` must include `text_assets`, `image_assets`, and `shared_assets`.",
		"- `slide_mapping[]` must exactly match the assets referenced by each slide's `content_blocks`.",
		"",
		"## Field Ownership",
		"",
		"Planner-owned fields:",
		...context.field_ownership.planner_owned.map(
			(fieldPath) => `- \`${fieldPath}\``,
		),
		"",
		"Workflow-managed fields. Do not author these as new source-of-truth fields:",
		...context.field_ownership.workflow_managed.map(
			(fieldPath) => `- \`${fieldPath}\``,
		),
		"",
		"## Deck Material Quality Bar",
		"",
		renderBulletList(plannerMaterialAuthoringRules),
		"",
		"## Required Visual Planning Rules",
		"",
		renderBulletList(plannerPromptAuthoringRules),
		"",
		"## Agent Execution Contract",
		"",
		"- This execution contract is legacy-only and should not be treated as the primary operator path.",
		`- Actor: \`${context.skill_handoff.actor}\``,
		`- Write JSON only to \`${context.skill_handoff.required_output_path}\`.`,
		`- After writing the candidate, run legacy publish command \`${context.skill_handoff.promotion_command}\` from the project directory.`,
		`- Treat a non-zero exit from \`${context.skill_handoff.promotion_command}\` as a failed legacy compatibility step unless the retry policy below explicitly permits one retry.`,
		`- Forbidden mutations while authoring the candidate: ${context.skill_handoff.forbidden_mutations.map((value) => `\`${value}\``).join(", ")}.`,
		"",
		"## Retry Policy",
		"",
		`- Policy: \`${context.skill_handoff.retry_policy}\``,
		`- Maximum legacy publish attempts: ${context.skill_handoff.max_promotion_attempts}`,
		`- Retryable failure kinds surfaced by \`${context.skill_handoff.promotion_command}\`: ${context.skill_handoff.retryable_failure_kinds.map((value) => `\`${value}\``).join(", ")}.`,
		"- Parse stderr lines that begin with `Failure kind:` and `Retryable by skill:` to decide whether one retry is allowed.",
		`- If the first legacy publish attempt fails with a retryable failure kind, copy the current candidate to \`${context.skill_handoff.debug_paths.last_invalid_candidate}\` and write the stderr failure summary to \`${context.skill_handoff.debug_paths.last_invalid_errors}\`.`,
		"- Fix the candidate using only the reported validation errors. Do not change the user prompt or skip the legacy publish command.",
		"- If the second promotion still fails, stop. Do not continue to `pnpm spec:review` or `pnpm media`.",
		"",
		"## Pre-write Checklist",
		"",
		"- Write JSON only. Do not include markdown fences or commentary.",
		"- Keep workflow-managed fields out of the candidate source of truth.",
		"- Make sure every slide, asset, and mapping reference is internally consistent before writing the file.",
		"- Ensure layout intents, layout slots, and block types stay inside the declared renderer contract.",
		"- Do not mutate `spec/deck-spec.json`, `output/`, or `media/` during candidate authoring.",
		"",
		"## Asset and Reference Rules",
		"",
		"- Asset ids must be unique across text, image, and shared assets.",
		"- `slide_id` values must be unique and must match `slide_mapping[].slide_id`.",
		"- Required assets must actually be referenced by `content_blocks`.",
		"- `image_assets[].slide_id` must match the slide that references the image.",
		"- Every required image asset should align to the slide objective, intended usage, and layout slot that will place it.",
		"- Text asset kinds must match the referencing block type: `text`, `badge`, and `callout` need `plain_text`; `bullet_list` needs `bullet_list`; `card` and `metric` sub-fields need `plain_text`.",
		"- Do not invent new layout intents, layout slots, or block types.",
		"",
		"## Reviewer Expectations",
		"",
		renderBulletList(reviewMaterialGuidance),
		"",
		"## Renderer Contract",
		"",
		renderRendererContractMarkdown(context.renderer_contract),
		"",
		renderExistingSpecSummaryMarkdown(context.existing_spec_summary),
		"",
		warningSection,
		"## Final Output Rules",
		"",
		"- Write JSON only.",
		"- Do not include code fences.",
		"- Do not include commentary before or after the JSON.",
	].join("\n");
}
