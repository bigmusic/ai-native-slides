import type { ReviewVisualPromptSummary } from "../deck-spec-module/reviewing/promptQuality.js";
import type { LayoutIntent } from "../spec/contract.js";
import type { RendererContractByLayoutIntent } from "../spec/rendererContract.js";
import type {
	DeckMaterialScoreDimensionId,
	ImagePromptScoreDimensionId,
	SpecReviewStatus,
} from "./planner-output.js";
import type { ScoreDimensionSpec } from "./scorecard.js";

export type PlannerSpecContextPaths = {
	planner_context_path: string;
	planner_brief_path: string;
	spec_candidate_path: string;
	canonical_spec_path: string;
	deck_spec_schema_path: string;
};

export type PlannerFieldOwnership = {
	planner_owned: string[];
	workflow_managed: string[];
};

export type PlannerSkillHandoff = {
	actor: "codex_skill_agent";
	required_output_path: string;
	promotion_command: "pnpm spec";
	retry_policy: "single_agent_retry_after_fail_fast";
	max_promotion_attempts: 2;
	retryable_failure_kinds: string[];
	debug_paths: {
		last_invalid_candidate: string;
		last_invalid_errors: string;
	};
	forbidden_mutations: string[];
};

export type ExistingSpecSlideSummary = {
	slide_id: string;
	title: string;
	layout_intent: LayoutIntent;
};

export type ExistingSpecSummary = {
	spec_status: string;
	slide_count: number;
	required_text_asset_count: number;
	required_image_asset_count: number;
	required_shared_asset_count: number;
	slides: ExistingSpecSlideSummary[];
};

export type PlannerBriefInput = {
	source_prompt: string;
	paths: PlannerSpecContextPaths;
	field_ownership: PlannerFieldOwnership;
	skill_handoff: PlannerSkillHandoff;
	renderer_contract: RendererContractByLayoutIntent;
	existing_spec_summary?: ExistingSpecSummary;
	warnings?: string[];
};

export type SpecReviewContextPaths = {
	review_context_path: string;
	review_brief_path: string;
	review_candidate_path: string;
	canonical_spec_path: string;
	promoted_review_json_path: string;
	promoted_review_markdown_path: string;
};

export type ReviewSkillHandoff = {
	actor: "codex_skill_agent";
	required_output_path: string;
	promotion_command: "pnpm spec:review";
	forbidden_mutations: string[];
};

export type ReviewStatusPolicy = {
	status: SpecReviewStatus;
	description: string;
	hard_requirements: string[];
	common_examples: string[];
};

export type ReviewRubricCheck = {
	check_id: string;
	title: string;
	instruction: string;
	fail_when: string[];
	warn_when: string[];
};

export type ReviewSlideSummary = {
	slide_id: string;
	title: string;
	layout_intent: LayoutIntent;
	objectives: string[];
	text_asset_ids: string[];
	image_asset_ids: string[];
	shared_asset_ids: string[];
};

export type CanonicalSpecReviewSummary = {
	spec_status: string;
	generated_at: string;
	slide_count: number;
	required_image_asset_count: number;
	required_shared_asset_count: number;
	slides: ReviewSlideSummary[];
	visual_assets: ReviewVisualPromptSummary[];
};

export type ReviewBriefInput = {
	source_prompt: string;
	paths: SpecReviewContextPaths;
	skill_handoff: ReviewSkillHandoff;
	status_policy: ReviewStatusPolicy[];
	review_rubric: ReviewRubricCheck[];
	canonical_spec_summary: CanonicalSpecReviewSummary;
	deck_material_dimensions: readonly ScoreDimensionSpec<DeckMaterialScoreDimensionId>[];
	image_prompt_dimensions: readonly ScoreDimensionSpec<ImagePromptScoreDimensionId>[];
};
