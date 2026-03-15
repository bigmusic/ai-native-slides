import type {
	AssetManifestCandidate,
	ContentBlock,
	DeckSpecCandidate,
	LayoutIntent,
	SlideMapping,
	SlidePlanCandidate,
	TextAssetCandidate,
} from "../../spec/contract.js";

import type { PromptModel } from "../prompt-interpreter/promptModel.js";

type TextAsset = TextAssetCandidate;

type SlideBlueprint = {
	slide_id: string;
	title: string;
	objectives: string[];
	layout_intent: LayoutIntent;
	content_blocks: ContentBlock[];
	text_assets: TextAsset[];
	image_assets: AssetManifestCandidate["image_assets"];
	shared_assets?: AssetManifestCandidate["shared_assets"];
};

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 48);
}

function toTitleCase(value: string): string {
	return value
		.split(/\s+/)
		.filter((part) => part.length > 0)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(" ");
}

function createPlainTextAsset(
	assetId: string,
	assetLabel: string,
	content: string,
): TextAsset {
	return {
		asset_id: assetId,
		asset_label: assetLabel,
		text_kind: "plain_text",
		content,
		required: true,
	};
}

function createBulletTextAsset(
	assetId: string,
	assetLabel: string,
	content: string[],
): TextAsset {
	return {
		asset_id: assetId,
		asset_label: assetLabel,
		text_kind: "bullet_list",
		content,
		required: true,
	};
}

function createImageAsset(
	slideId: string,
	assetId: string,
	assetLabel: string,
	subject: string,
): AssetManifestCandidate["image_assets"][number] {
	return {
		asset_id: assetId,
		asset_label: assetLabel,
		slide_id: slideId,
		intended_usage: "supporting_visual",
		size_tier: "large",
		style: "editorial presentation illustration",
		subject,
		aspect_ratio: "16:9",
		image_prompt_spec: {
			composition:
				"Use a clear focal point with layered depth, clean negative space, and strong alignment with the slide objective.",
			color_direction:
				"Use a restrained corporate palette with deep navy, teal accents, and warm neutral highlights.",
			detail_cues: [
				"subtle lighting contrast",
				"clear hierarchy between foreground and background",
				"presentation-ready visual simplicity",
			],
			avoid_elements: [
				"logos",
				"tiny unreadable text",
				"UI chrome",
				"watermarks",
			],
		},
		output_format: "png",
		required: true,
	};
}

function createSharedAsset(
	assetId: string,
	assetLabel: string,
	subject: string,
): AssetManifestCandidate["shared_assets"][number] {
	return {
		asset_id: assetId,
		asset_label: assetLabel,
		shared_scope: "deck",
		intended_usage: "background",
		size_tier: "medium",
		style: "subtle presentation texture",
		subject,
		aspect_ratio: "16:9",
		image_prompt_spec: {
			composition:
				"Create a subtle structured background texture with soft depth and generous open space for overlaid text.",
			color_direction:
				"Keep the palette muted with navy, slate, and faint teal tones.",
			detail_cues: [
				"low-contrast grid structure",
				"minimal visual noise",
				"broad unobtrusive pattern",
			],
			avoid_elements: [
				"logos",
				"readable text",
				"busy patterns",
				"strong focal objects",
			],
		},
		output_format: "png",
		required: true,
	};
}

function createSlideMapping(slide: SlideBlueprint): SlideMapping {
	return {
		slide_id: slide.slide_id,
		text_asset_ids: slide.text_assets.map((asset) => asset.asset_id),
		image_asset_ids: slide.image_assets.map((asset) => asset.asset_id),
		shared_asset_ids: slide.shared_assets?.map((asset) => asset.asset_id) ?? [],
	};
}

function createHeroSlide(model: PromptModel): SlideBlueprint {
	const slideId = "overview_hero";
	const keywordLabel = toTitleCase(model.themeLabel);
	return {
		slide_id: slideId,
		title: `${keywordLabel} Overview`,
		objectives: [
			`Establish the deck narrative around ${model.themeLabel}.`,
			"Make the contract-first workflow feel structured, deliberate, and presentation-ready.",
		],
		layout_intent: "hero",
		content_blocks: [
			{
				block_id: "hero_badge_block",
				block_type: "badge",
				layout_slot: "eyebrow_badge",
				text_asset_id: "hero_badge",
			},
			{
				block_id: "hero_message_block",
				block_type: "text",
				layout_slot: "hero_message",
				text_asset_id: "hero_message",
			},
			{
				block_id: "hero_visual_block",
				block_type: "image",
				layout_slot: "hero_visual",
				image_asset_id: "hero_visual_asset",
			},
		],
		text_assets: [
			createPlainTextAsset(
				"hero_badge",
				"Hero badge",
				"Canonical deck-spec workflow",
			),
			createPlainTextAsset(
				"hero_message",
				"Hero message",
				`This deck translates the user prompt into one canonical spec that can drive validation, review, media generation, and deterministic deck delivery without hidden mutable state.`,
			),
		],
		image_assets: [
			createImageAsset(
				slideId,
				"hero_visual_asset",
				"Hero workflow visual",
				`${model.themeLabel} workflow overview with structured handoff layers`,
			),
		],
	};
}

function createReviewSlide(model: PromptModel): SlideBlueprint {
	const slideId = "semantic_review";
	return {
		slide_id: slideId,
		title: "Semantic Review Gate",
		objectives: [
			"Show that review is an evaluator around the candidate spec, not part of the core module contract.",
			"Keep canonical publish gated by prompt alignment rather than by hidden side effects.",
		],
		layout_intent: "split_visual",
		content_blocks: [
			{
				block_id: "review_badge_block",
				block_type: "badge",
				layout_slot: "eyebrow_badge",
				text_asset_id: "review_badge",
			},
			{
				block_id: "review_message_block",
				block_type: "bullet_list",
				layout_slot: "split_message",
				text_asset_id: "review_message_bullets",
			},
			{
				block_id: "review_visual_block",
				block_type: "image",
				layout_slot: "split_visual",
				image_asset_id: "review_visual_asset",
			},
			{
				block_id: "review_callout_block",
				block_type: "callout",
				layout_slot: "split_callout",
				text_asset_id: "review_callout",
			},
		],
		text_assets: [
			createPlainTextAsset(
				"review_badge",
				"Review badge",
				"External evaluator",
			),
			createBulletTextAsset("review_message_bullets", "Review bullets", [
				"Candidate deck-spec is reviewed before canonical publish.",
				"Pass and warn can publish; fail preserves diagnostics without overwriting the prior canonical spec.",
				"Review logic stays outside the stateless planning module.",
			]),
			createPlainTextAsset(
				"review_callout",
				"Review callout",
				`The user prompt remains the source of truth, while review adds an explicit decision layer around ${model.themeLabel}.`,
			),
		],
		image_assets: [
			createImageAsset(
				slideId,
				"review_visual_asset",
				"Semantic review visual",
				"decision gate around a candidate canonical deck spec with clear pass warn fail branches",
			),
		],
	};
}

function createCardsSlide(model: PromptModel): SlideBlueprint {
	return {
		slide_id: "canonical_inputs",
		title: "Canonical Asset Plan",
		objectives: [
			"Show how text, image, and shared assets are planned inside one canonical document.",
			"Keep output filenames, asset ids, and mapping stable for downstream workflows.",
		],
		layout_intent: "cards",
		content_blocks: [
			{
				block_id: "adoption_bullets_block",
				block_type: "bullet_list",
				layout_slot: "supporting_bullets",
				text_asset_id: "adoption_bullets",
			},
			{
				block_id: "contract_card_block",
				block_type: "card",
				layout_slot: "primary_card",
				title_asset_id: "card_title_contract",
				body_asset_id: "card_body_contract",
				accent_token: "deck_teal",
			},
			{
				block_id: "mapping_card_block",
				block_type: "card",
				layout_slot: "secondary_card",
				title_asset_id: "card_title_mapping",
				body_asset_id: "card_body_mapping",
				accent_token: "deck_navy",
			},
			{
				block_id: "filename_card_block",
				block_type: "card",
				layout_slot: "tertiary_card",
				title_asset_id: "card_title_filename",
				body_asset_id: "card_body_filename",
				accent_token: "deck_amber",
			},
			{
				block_id: "cards_review_callout_block",
				block_type: "callout",
				layout_slot: "review_callout",
				text_asset_id: "cards_review_callout",
			},
			{
				block_id: "background_grid_block",
				block_type: "image",
				layout_slot: "background_texture",
				shared_asset_id: "shared_background_grid",
			},
		],
		text_assets: [
			createBulletTextAsset("adoption_bullets", "Supporting bullets", [
				"Planning stays prompt-driven, but the resulting spec is normalized and validated before publication.",
				"Asset planning, prompt compilation policy, and file naming rules are internal module behavior.",
				"Build and media steps consume only the canonical deck-spec output.",
			]),
			createPlainTextAsset(
				"card_title_contract",
				"Contract card title",
				"Single business artifact",
			),
			createPlainTextAsset(
				"card_body_contract",
				"Contract card body",
				"The workflow publishes one canonical deck-spec rather than spreading business state across intermediate files.",
			),
			createPlainTextAsset(
				"card_title_mapping",
				"Mapping card title",
				"Stable mapping",
			),
			createPlainTextAsset(
				"card_body_mapping",
				"Mapping card body",
				"Every slide, block, and asset identity is derived deterministically from the prompt model and renderer contract.",
			),
			createPlainTextAsset(
				"card_title_filename",
				"Filename card title",
				"Deterministic filenames",
			),
			createPlainTextAsset(
				"card_body_filename",
				"Filename card body",
				"Output filenames and media tiers stay system-managed so downstream generation remains reproducible.",
			),
			createPlainTextAsset(
				"cards_review_callout",
				"Cards callout",
				`${toTitleCase(model.themeLabel)} becomes concrete only after internal asset planning and canonical validation align.`,
			),
		],
		image_assets: [],
		shared_assets: [
			createSharedAsset(
				"shared_background_grid",
				"Shared background grid",
				"subtle structured texture for canonical asset planning slide",
			),
		],
	};
}

function createMetricsSlide(model: PromptModel): SlideBlueprint {
	const slideId = "delivery_metrics";
	const visualCount = String(model.targetSlideCount + 2);
	return {
		slide_id: slideId,
		title: "Validation Signals",
		objectives: [
			"Translate the planned workflow into measurable validation checkpoints.",
			"Make the review and publish contract legible to operators and maintainers.",
		],
		layout_intent: "metrics",
		content_blocks: [
			{
				block_id: "metric_slides_block",
				block_type: "metric",
				layout_slot: "left_metric",
				value_asset_id: "metric_value_slides",
				label_asset_id: "metric_label_slides",
				accent_token: "deck_teal",
			},
			{
				block_id: "metric_assets_block",
				block_type: "metric",
				layout_slot: "center_metric",
				value_asset_id: "metric_value_assets",
				label_asset_id: "metric_label_assets",
				accent_token: "deck_navy",
			},
			{
				block_id: "metric_status_block",
				block_type: "metric",
				layout_slot: "right_metric",
				value_asset_id: "metric_value_status",
				label_asset_id: "metric_label_status",
				accent_token: "deck_amber",
			},
			{
				block_id: "audience_callout_block",
				block_type: "text",
				layout_slot: "supporting_text",
				text_asset_id: "audience_callout",
			},
			{
				block_id: "metrics_visual_block",
				block_type: "image",
				layout_slot: "supporting_visual",
				image_asset_id: "metrics_support_visual",
			},
		],
		text_assets: [
			createPlainTextAsset(
				"metric_value_slides",
				"Metric slide count",
				String(model.targetSlideCount),
			),
			createPlainTextAsset(
				"metric_label_slides",
				"Metric slide label",
				"Planned slides",
			),
			createPlainTextAsset(
				"metric_value_assets",
				"Metric asset count",
				visualCount,
			),
			createPlainTextAsset(
				"metric_label_assets",
				"Metric asset label",
				"Visual assets",
			),
			createPlainTextAsset(
				"metric_value_status",
				"Metric status value",
				"PASS/WARN",
			),
			createPlainTextAsset(
				"metric_label_status",
				"Metric status label",
				"Publish gate",
			),
			createPlainTextAsset(
				"audience_callout",
				"Audience callout",
				`Validation in this workflow is designed to keep ${model.themeLabel} reproducible for operators, reviewers, and downstream build steps.`,
			),
		],
		image_assets: [
			createImageAsset(
				slideId,
				"metrics_support_visual",
				"Metrics support visual",
				"structured dashboard-like presentation visual showing validation checkpoints and gated publish states",
			),
		],
	};
}

function createTimelineSlide(): SlideBlueprint {
	return {
		slide_id: "operator_timeline",
		title: "Operator Flow",
		objectives: [
			"Show the runtime path from prompt intake to canonical publish and downstream media execution.",
			"Keep filesystem writes and CLI concerns outside the stateless planning core.",
		],
		layout_intent: "timeline",
		content_blocks: [
			{
				block_id: "timeline_step_one_block",
				block_type: "card",
				layout_slot: "timeline_step_1",
				title_asset_id: "timeline_step_1_title",
				body_asset_id: "timeline_step_1_body",
				accent_token: "deck_teal",
			},
			{
				block_id: "timeline_step_two_block",
				block_type: "card",
				layout_slot: "timeline_step_2",
				title_asset_id: "timeline_step_2_title",
				body_asset_id: "timeline_step_2_body",
				accent_token: "deck_navy",
			},
			{
				block_id: "timeline_step_three_block",
				block_type: "card",
				layout_slot: "timeline_step_3",
				title_asset_id: "timeline_step_3_title",
				body_asset_id: "timeline_step_3_body",
				accent_token: "deck_amber",
			},
			{
				block_id: "timeline_step_four_block",
				block_type: "card",
				layout_slot: "timeline_step_4",
				title_asset_id: "timeline_step_4_title",
				body_asset_id: "timeline_step_4_body",
				accent_token: "deck_coral",
			},
			{
				block_id: "timeline_summary_block",
				block_type: "callout",
				layout_slot: "timeline_summary",
				text_asset_id: "timeline_summary",
			},
		],
		text_assets: [
			createPlainTextAsset(
				"timeline_step_1_title",
				"Timeline step 1 title",
				"Interpret prompt",
			),
			createPlainTextAsset(
				"timeline_step_1_body",
				"Timeline step 1 body",
				"Translate the user prompt into a normalized prompt model without touching the filesystem.",
			),
			createPlainTextAsset(
				"timeline_step_2_title",
				"Timeline step 2 title",
				"Plan canonical spec",
			),
			createPlainTextAsset(
				"timeline_step_2_body",
				"Timeline step 2 body",
				"Build slides, asset manifest, and mapping with deterministic ids, filenames, and layout-aware content blocks.",
			),
			createPlainTextAsset(
				"timeline_step_3_title",
				"Timeline step 3 title",
				"Review candidate",
			),
			createPlainTextAsset(
				"timeline_step_3_body",
				"Timeline step 3 body",
				"Evaluate the candidate canonical spec outside the core module before deciding whether to publish.",
			),
			createPlainTextAsset(
				"timeline_step_4_title",
				"Timeline step 4 title",
				"Publish and render",
			),
			createPlainTextAsset(
				"timeline_step_4_body",
				"Timeline step 4 body",
				"Publish canonical deck-spec, then let media generation and deterministic build consume that stable output.",
			),
			createPlainTextAsset(
				"timeline_summary",
				"Timeline summary",
				"Stateless planning stays pure; workflow owns diagnostics, review, publishing, and follow-on generation.",
			),
		],
		image_assets: [],
	};
}

function createClosingSlide(model: PromptModel): SlideBlueprint {
	const slideId = "stable_build";
	return {
		slide_id: slideId,
		title: "Build From Stable Inputs",
		objectives: [
			"Close on the contract that downstream steps only trust canonical spec plus generated media.",
			"Make failure behavior explicit so the workflow can be rerun safely.",
		],
		layout_intent: "closing",
		content_blocks: [
			{
				block_id: "closing_badge_block",
				block_type: "badge",
				layout_slot: "closing_badge",
				text_asset_id: "closing_badge",
			},
			{
				block_id: "closing_message_block",
				block_type: "text",
				layout_slot: "closing_message",
				text_asset_id: "closing_message",
			},
			{
				block_id: "closing_visual_block",
				block_type: "image",
				layout_slot: "closing_visual",
				image_asset_id: "closing_visual_asset",
			},
			{
				block_id: "closing_callout_block",
				block_type: "callout",
				layout_slot: "closing_callout",
				text_asset_id: "closing_callout",
			},
		],
		text_assets: [
			createPlainTextAsset(
				"closing_badge",
				"Closing badge",
				"Stable downstream contract",
			),
			createPlainTextAsset(
				"closing_message",
				"Closing message",
				`Once the canonical deck-spec is published, media generation and build can operate on ${slugify(model.themeLabel)} with deterministic, inspectable inputs.`,
			),
			createPlainTextAsset(
				"closing_callout",
				"Closing callout",
				"Failing review preserves diagnostics without corrupting the previously trusted canonical output.",
			),
		],
		image_assets: [
			createImageAsset(
				slideId,
				"closing_visual_asset",
				"Closing stable build visual",
				"confident presentation delivery scene built from stable canonical inputs and generated media",
			),
		],
	};
}

function selectSlides(model: PromptModel): SlideBlueprint[] {
	const allSlides = [
		createHeroSlide(model),
		createReviewSlide(model),
		createCardsSlide(model),
		createMetricsSlide(model),
		createTimelineSlide(),
		createClosingSlide(model),
	];

	if (model.targetSlideCount >= allSlides.length) {
		return allSlides;
	}

	const retained = allSlides.slice(0, Math.max(2, model.targetSlideCount - 1));
	return [...retained, createClosingSlide(model)];
}

export function buildDeckSpecCandidateFromPrompt(
	model: PromptModel,
): DeckSpecCandidate {
	const slides = selectSlides(model);
	const textAssets = slides.flatMap((slide) => slide.text_assets);
	const imageAssets = slides.flatMap((slide) => slide.image_assets);
	const sharedAssets = slides.flatMap((slide) => slide.shared_assets ?? []);
	const slideMappings = slides.map(createSlideMapping);

	return {
		target_slide_count: slides.length,
		slides: slides.map(
			(slide): SlidePlanCandidate => ({
				slide_id: slide.slide_id,
				title: slide.title,
				objectives: slide.objectives,
				layout_intent: slide.layout_intent,
				content_blocks: slide.content_blocks,
			}),
		),
		asset_manifest: {
			text_assets: textAssets,
			image_assets: imageAssets,
			shared_assets: sharedAssets,
		},
		slide_mapping: slideMappings,
	};
}
