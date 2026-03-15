import type { BlockType, LayoutIntent } from "./contract.js";

export type RendererSlotContract = {
	required: boolean;
	allowedBlockTypes: readonly BlockType[];
};

export type RendererContractByLayoutIntent = Record<
	LayoutIntent,
	Record<string, RendererSlotContract>
>;

export const rendererContractByLayoutIntent = {
	hero: {
		eyebrow_badge: {
			required: true,
			allowedBlockTypes: ["badge"],
		},
		hero_message: {
			required: true,
			allowedBlockTypes: ["text"],
		},
		hero_visual: {
			required: true,
			allowedBlockTypes: ["image"],
		},
	},
	split_visual: {
		eyebrow_badge: {
			required: false,
			allowedBlockTypes: ["badge"],
		},
		split_message: {
			required: true,
			allowedBlockTypes: ["text", "bullet_list"],
		},
		split_visual: {
			required: true,
			allowedBlockTypes: ["image"],
		},
		split_callout: {
			required: false,
			allowedBlockTypes: ["callout"],
		},
	},
	cards: {
		supporting_bullets: {
			required: true,
			allowedBlockTypes: ["bullet_list"],
		},
		primary_card: {
			required: true,
			allowedBlockTypes: ["card"],
		},
		secondary_card: {
			required: false,
			allowedBlockTypes: ["card"],
		},
		tertiary_card: {
			required: false,
			allowedBlockTypes: ["card"],
		},
		review_callout: {
			required: false,
			allowedBlockTypes: ["callout"],
		},
		background_texture: {
			required: false,
			allowedBlockTypes: ["image"],
		},
	},
	metrics: {
		left_metric: {
			required: true,
			allowedBlockTypes: ["metric"],
		},
		center_metric: {
			required: false,
			allowedBlockTypes: ["metric"],
		},
		right_metric: {
			required: true,
			allowedBlockTypes: ["metric"],
		},
		supporting_text: {
			required: true,
			allowedBlockTypes: ["text"],
		},
		supporting_visual: {
			required: true,
			allowedBlockTypes: ["image"],
		},
	},
	timeline: {
		timeline_step_1: {
			required: true,
			allowedBlockTypes: ["card"],
		},
		timeline_step_2: {
			required: true,
			allowedBlockTypes: ["card"],
		},
		timeline_step_3: {
			required: true,
			allowedBlockTypes: ["card"],
		},
		timeline_step_4: {
			required: false,
			allowedBlockTypes: ["card"],
		},
		timeline_summary: {
			required: false,
			allowedBlockTypes: ["text", "callout"],
		},
	},
	closing: {
		closing_badge: {
			required: false,
			allowedBlockTypes: ["badge"],
		},
		closing_message: {
			required: true,
			allowedBlockTypes: ["text"],
		},
		closing_visual: {
			required: false,
			allowedBlockTypes: ["image"],
		},
		closing_callout: {
			required: false,
			allowedBlockTypes: ["callout"],
		},
	},
} satisfies RendererContractByLayoutIntent;
