export const DEFAULT_DECK_SPEC_VERSION = "1.0.0";

export const plannerOwnedDeckSpecFieldPaths = [
	"target_slide_count",
	"slides",
	"asset_manifest",
	"slide_mapping",
] as const;

export const workflowManagedDeckSpecFieldPaths = [
	"source_prompt",
	"spec_version",
	"generated_at",
	"project_slug",
	"status",
	"slides[].status",
	"asset_manifest.text_assets[].status",
	"asset_manifest.image_assets[].status",
	"asset_manifest.image_assets[].output_file_name",
	"asset_manifest.shared_assets[].status",
	"asset_manifest.shared_assets[].output_file_name",
] as const;

export const deckSpecStatusValues = [
	"planned",
	"validated",
	"reviewed",
	"media_ready",
] as const;
export type DeckSpecStatus = (typeof deckSpecStatusValues)[number];

export const slideStatusValues = ["planned", "validated"] as const;
export type SlideStatus = (typeof slideStatusValues)[number];

export const layoutIntentValues = [
	"hero",
	"split_visual",
	"cards",
	"metrics",
	"timeline",
	"closing",
] as const;
export type LayoutIntent = (typeof layoutIntentValues)[number];

export const textAssetStatusValues = [
	"planned",
	"placed",
	"validated",
] as const;
export type TextAssetStatus = (typeof textAssetStatusValues)[number];

export const imageAssetStatusValues = [
	"planned",
	"generated",
	"placed",
	"validated",
] as const;
export type ImageAssetStatus = (typeof imageAssetStatusValues)[number];

export const textKindValues = ["plain_text", "bullet_list"] as const;
export type TextKind = (typeof textKindValues)[number];

export const imageIntendedUsageValues = [
	"hero_visual",
	"supporting_visual",
	"background",
	"diagram",
	"icon",
	"cutout",
] as const;
export type ImageIntendedUsage = (typeof imageIntendedUsageValues)[number];

export const sizeTierValues = ["small", "medium", "large"] as const;
export type SizeTier = (typeof sizeTierValues)[number];

export const aspectRatioValues = [
	"1:1",
	"4:3",
	"3:2",
	"16:9",
	"16:10",
	"9:16",
] as const;
export type AspectRatio = (typeof aspectRatioValues)[number];

export const outputFormatValues = ["jpg", "png"] as const;
export type OutputFormat = (typeof outputFormatValues)[number];

export const blockTypeValues = [
	"text",
	"bullet_list",
	"image",
	"badge",
	"card",
	"metric",
	"callout",
] as const;
export type BlockType = (typeof blockTypeValues)[number];

export type ImagePromptSpec = {
	composition: string;
	color_direction: string;
	detail_cues: string[];
	avoid_elements: string[];
};

export type PlainTextAsset = {
	asset_id: string;
	asset_label: string;
	text_kind: "plain_text";
	content: string;
	required: boolean;
	status: TextAssetStatus;
};

export type BulletListAsset = {
	asset_id: string;
	asset_label: string;
	text_kind: "bullet_list";
	content: string[];
	required: boolean;
	status: TextAssetStatus;
};

export type TextAsset = PlainTextAsset | BulletListAsset;

export type PlainTextAssetCandidate = Omit<PlainTextAsset, "status"> &
	Partial<Pick<PlainTextAsset, "status">>;

export type BulletListAssetCandidate = Omit<BulletListAsset, "status"> &
	Partial<Pick<BulletListAsset, "status">>;

export type TextAssetCandidate =
	| PlainTextAssetCandidate
	| BulletListAssetCandidate;

export type DeckImageAsset = {
	asset_id: string;
	asset_label: string;
	slide_id: string;
	intended_usage: ImageIntendedUsage;
	size_tier: SizeTier;
	style: string;
	subject: string;
	aspect_ratio: AspectRatio;
	image_prompt_spec: ImagePromptSpec;
	output_format: OutputFormat;
	required: boolean;
	output_file_name: string;
	status: ImageAssetStatus;
};

export type DeckImageAssetCandidate = Omit<
	DeckImageAsset,
	"output_file_name" | "status"
> &
	Partial<Pick<DeckImageAsset, "output_file_name" | "status">>;

export type SharedVisualAsset = {
	asset_id: string;
	asset_label: string;
	shared_scope: "deck";
	intended_usage: ImageIntendedUsage;
	size_tier: SizeTier;
	style: string;
	subject: string;
	aspect_ratio: AspectRatio;
	image_prompt_spec: ImagePromptSpec;
	output_format: OutputFormat;
	required: boolean;
	output_file_name: string;
	status: ImageAssetStatus;
};

export type SharedVisualAssetCandidate = Omit<
	SharedVisualAsset,
	"output_file_name" | "status"
> &
	Partial<Pick<SharedVisualAsset, "output_file_name" | "status">>;

export type TextContentBlock = {
	block_id: string;
	block_type: "text";
	layout_slot: string;
	text_asset_id: string;
};

export type BulletListContentBlock = {
	block_id: string;
	block_type: "bullet_list";
	layout_slot: string;
	text_asset_id: string;
};

export type ImageAssetContentBlock = {
	block_id: string;
	block_type: "image";
	layout_slot: string;
	image_asset_id: string;
};

export type SharedImageContentBlock = {
	block_id: string;
	block_type: "image";
	layout_slot: string;
	shared_asset_id: string;
};

export type BadgeContentBlock = {
	block_id: string;
	block_type: "badge";
	layout_slot: string;
	text_asset_id: string;
};

export type CardContentBlock = {
	block_id: string;
	block_type: "card";
	layout_slot: string;
	title_asset_id: string;
	body_asset_id: string;
	accent_token?: string;
};

export type MetricContentBlock = {
	block_id: string;
	block_type: "metric";
	layout_slot: string;
	value_asset_id: string;
	label_asset_id: string;
	accent_token?: string;
};

export type CalloutContentBlock = {
	block_id: string;
	block_type: "callout";
	layout_slot: string;
	text_asset_id: string;
};

export type ContentBlock =
	| TextContentBlock
	| BulletListContentBlock
	| ImageAssetContentBlock
	| SharedImageContentBlock
	| BadgeContentBlock
	| CardContentBlock
	| MetricContentBlock
	| CalloutContentBlock;

export type SlidePlan = {
	slide_id: string;
	title: string;
	objectives: string[];
	layout_intent: LayoutIntent;
	content_blocks: ContentBlock[];
	status: SlideStatus;
};

export type SlidePlanCandidate = Omit<SlidePlan, "status"> &
	Partial<Pick<SlidePlan, "status">>;

export type AssetManifest = {
	text_assets: TextAsset[];
	image_assets: DeckImageAsset[];
	shared_assets: SharedVisualAsset[];
};

export type AssetManifestCandidate = {
	text_assets: TextAssetCandidate[];
	image_assets: DeckImageAssetCandidate[];
	shared_assets: SharedVisualAssetCandidate[];
};

export type SlideMapping = {
	slide_id: string;
	text_asset_ids: string[];
	image_asset_ids: string[];
	shared_asset_ids: string[];
};

export type DeckSpec = {
	spec_version: string;
	generated_at: string;
	project_slug: string;
	source_prompt: string;
	target_slide_count: number;
	slides: SlidePlan[];
	asset_manifest: AssetManifest;
	slide_mapping: SlideMapping[];
	status: DeckSpecStatus;
};

export type DeckSpecCandidate = {
	target_slide_count: number;
	slides: SlidePlanCandidate[];
	asset_manifest: AssetManifestCandidate;
	slide_mapping: SlideMapping[];
} & Partial<
	Pick<
		DeckSpec,
		| "spec_version"
		| "generated_at"
		| "project_slug"
		| "source_prompt"
		| "status"
	>
>;
