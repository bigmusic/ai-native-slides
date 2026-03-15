import type { DeckSpecCandidate } from "../../spec/contract.js";
import {
	blockTypeValues,
	imageIntendedUsageValues,
	layoutIntentValues,
	outputFormatValues,
	plannerOwnedDeckSpecFieldPaths,
	sizeTierValues,
	workflowManagedDeckSpecFieldPaths,
} from "../../spec/contract.js";
import { rendererContractByLayoutIntent } from "../../spec/rendererContract.js";
import type {
	DeckSpecPlanningDiagnostics,
	PlanningAttemptStrategy,
} from "../errors.js";

function renderJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function renderStrategyNote(strategy: PlanningAttemptStrategy): string {
	return strategy === "primary"
		? "Generate the strongest canonical deck-spec candidate directly from the user prompt."
		: "Repair the prior candidate so it satisfies validation and semantic review. Preserve the user's requested outcome while fixing structural or semantic issues.";
}

const canonicalCandidateExample: DeckSpecCandidate = {
	target_slide_count: 1,
	slides: [
		{
			slide_id: "opening_overview",
			title: "Opening Overview",
			objectives: [
				"Frame the deck outcome in one clear sentence.",
				"Give the hero slide enough narrative context to stand on its own.",
			],
			layout_intent: "hero",
			content_blocks: [
				{
					block_id: "opening_badge_block",
					block_type: "badge",
					layout_slot: "eyebrow_badge",
					text_asset_id: "opening_badge",
				},
				{
					block_id: "opening_message_block",
					block_type: "text",
					layout_slot: "hero_message",
					text_asset_id: "opening_message",
				},
				{
					block_id: "opening_visual_block",
					block_type: "image",
					layout_slot: "hero_visual",
					image_asset_id: "opening_visual_asset",
				},
			],
		},
	],
	asset_manifest: {
		text_assets: [
			{
				asset_id: "opening_badge",
				asset_label: "Opening badge",
				text_kind: "plain_text",
				content: "Canonical planning boundary",
				required: true,
			},
			{
				asset_id: "opening_message",
				asset_label: "Opening message",
				text_kind: "plain_text",
				content:
					"The deck-spec module owns prompt interpretation, semantic review, and one repair retry before canonical publish.",
				required: true,
			},
		],
		image_assets: [
			{
				asset_id: "opening_visual_asset",
				asset_label: "Opening overview visual",
				slide_id: "opening_overview",
				intended_usage: "hero_visual",
				size_tier: "large",
				style: "editorial product illustration",
				subject:
					"team reviewing one canonical planning boundary before deck production",
				aspect_ratio: "16:9",
				image_prompt_spec: {
					composition:
						"Show one focal planning artifact in the center with the team aligned around it in a presentation-ready editorial style.",
					color_direction:
						"Use restrained blue, teal, and warm neutral accents with clean contrast.",
					detail_cues: [
						"clear focal point",
						"presentation-safe composition",
						"minimal background clutter",
					],
					avoid_elements: ["logos", "tiny unreadable text", "UI chrome"],
				},
				output_format: "png",
				required: true,
			},
		],
		shared_assets: [],
	},
	slide_mapping: [
		{
			slide_id: "opening_overview",
			text_asset_ids: ["opening_badge", "opening_message"],
			image_asset_ids: ["opening_visual_asset"],
			shared_asset_ids: [],
		},
	],
};

export function buildInitialPlannerPrompt(sourcePrompt: string): string {
	return buildPlannerPrompt({
		sourcePrompt,
		strategy: "primary",
	});
}

export function buildRepairPlannerPrompt(input: {
	sourcePrompt: string;
	previousCandidate: DeckSpecCandidate;
	diagnostics: DeckSpecPlanningDiagnostics;
}): string {
	return buildPlannerPrompt({
		sourcePrompt: input.sourcePrompt,
		strategy: "fallback",
		previousCandidate: input.previousCandidate,
		diagnostics: input.diagnostics,
	});
}

function buildPlannerPrompt(input: {
	sourcePrompt: string;
	strategy: PlanningAttemptStrategy;
	previousCandidate?: DeckSpecCandidate;
	diagnostics?: DeckSpecPlanningDiagnostics;
}): string {
	const repairSection =
		input.strategy === "fallback"
			? [
					"## Repair Context",
					"",
					"Fix the prior candidate instead of inventing a new workflow contract.",
					"",
					"### Previous Candidate",
					"",
					renderJson(input.previousCandidate),
					"",
					"### Failure Diagnostics",
					"",
					renderJson(input.diagnostics),
					"",
				].join("\n")
			: "";

	return [
		"# Canonical Deck-Spec Planner",
		"",
		"Return JSON only. Do not use markdown fences or commentary.",
		renderStrategyNote(input.strategy),
		"",
		"## User Prompt",
		"",
		input.sourcePrompt,
		"",
		"## Output Contract",
		"",
		"Produce a JSON object with only planner-owned fields:",
		...plannerOwnedDeckSpecFieldPaths.map((field) => `- \`${field}\``),
		"",
		"Do not author workflow-managed fields:",
		...workflowManagedDeckSpecFieldPaths.map((field) => `- \`${field}\``),
		"",
		"## Required Structure",
		"",
		"- Top-level keys: `target_slide_count`, `slides`, `asset_manifest`, `slide_mapping`.",
		"- `slides[]` must include `slide_id`, `title`, `objectives`, `layout_intent`, `content_blocks`.",
		"- `asset_manifest` must include `text_assets`, `image_assets`, `shared_assets`.",
		"- `slide_mapping[]` must match the slide content blocks exactly.",
		"- Asset ids must be unique across text, image, and shared assets.",
		"- Use exact contract keys. Do not rename keys such as `block_type`, `text_kind`, `image_prompt_spec`, `text_asset_id`, `image_asset_id`, or `shared_asset_id`.",
		"- Do not use generic aliases such as `type`, `asset_id`, `text_content`, or `image_prompt` inside nested objects.",
		"",
		"## Allowed Enums",
		"",
		`- layout_intent: ${layoutIntentValues.map((value) => `\`${value}\``).join(", ")}`,
		`- image intended_usage: ${imageIntendedUsageValues.map((value) => `\`${value}\``).join(", ")}`,
		`- size_tier: ${sizeTierValues.map((value) => `\`${value}\``).join(", ")}`,
		`- output_format: ${outputFormatValues.map((value) => `\`${value}\``).join(", ")}`,
		`- content block types: ${blockTypeValues.map((value) => `\`${value}\``).join(", ")}`,
		"",
		"## Canonical JSON Shape Example",
		"",
		"This example shows the exact field names and nested object shapes to follow. Match this structure even when your content differs.",
		"",
		renderJson(canonicalCandidateExample),
		"",
		"## Renderer Contract",
		"",
		renderJson(rendererContractByLayoutIntent),
		"",
		"## Planning Rules",
		"",
		"- Keep the deck presentation-ready and coherent for the named audience.",
		"- Every required image or shared visual asset must be referenced by both slide content blocks and slide_mapping.",
		"- Image prompt specs must be specific, safe, and presentation-ready.",
		"- Avoid placeholder copy, TODO text, and thin one-line narrative content except for intentional short-form labels.",
		"- If the prompt explicitly asks for audience framing before workflow detail, allocate that slide order explicitly.",
		"",
		repairSection,
		"## Final Rule",
		"",
		"Return one valid JSON object only.",
	].join("\n");
}
