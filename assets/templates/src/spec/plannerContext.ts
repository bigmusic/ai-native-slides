import path from "node:path";

import { renderPlannerBriefMarkdown as renderPlannerBriefMarkdownCore } from "../planner-agent/planner-brief.js";
import type {
	ExistingSpecSummary,
	PlannerBriefInput,
	PlannerSkillHandoff,
} from "../planner-agent/planner-input.js";
import type { DeckSpec } from "./contract.js";
import {
	plannerOwnedDeckSpecFieldPaths,
	workflowManagedDeckSpecFieldPaths,
} from "./contract.js";
import {
	resolveDeckSpecPath,
	resolveDeckSpecSchemaPath,
	resolvePlannerBriefPath,
	resolvePlannerContextPath,
	resolveProjectDir,
	resolveSpecCandidateLastErrorsPath,
	resolveSpecCandidateLastInvalidPath,
	resolveSpecCandidatePath,
} from "./readDeckSpec.js";
import { rendererContractByLayoutIntent } from "./rendererContract.js";

export type {
	ExistingSpecSummary,
	PlannerBriefInput,
	PlannerFieldOwnership,
	PlannerSkillHandoff,
	PlannerSpecContextPaths,
} from "../planner-agent/planner-input.js";

export const skillRetryableSpecPromotionFailureKinds = [
	"candidate_invalid_json",
	"candidate_validation_failed",
] as const;
export type SkillRetryableSpecPromotionFailureKind =
	(typeof skillRetryableSpecPromotionFailureKinds)[number];

export type PlannerContext = PlannerBriefInput & {
	project_slug: string;
};

export type PlannerContextValidationError = {
	path: string;
	message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyStrings(values: unknown): values is string[] {
	return (
		Array.isArray(values) && values.every((value) => typeof value === "string")
	);
}

function pushError(
	errors: PlannerContextValidationError[],
	pathValue: string,
	message: string,
): void {
	errors.push({
		path: pathValue,
		message,
	});
}

export function createExistingSpecSummary(plan: DeckSpec): ExistingSpecSummary {
	return {
		spec_status: plan.status,
		slide_count: plan.slides.length,
		required_text_asset_count: plan.asset_manifest.text_assets.filter(
			(asset) => asset.required,
		).length,
		required_image_asset_count: plan.asset_manifest.image_assets.filter(
			(asset) => asset.required,
		).length,
		required_shared_asset_count: plan.asset_manifest.shared_assets.filter(
			(asset) => asset.required,
		).length,
		slides: plan.slides.map((slide) => ({
			slide_id: slide.slide_id,
			title: slide.title,
			layout_intent: slide.layout_intent,
		})),
	};
}

export function createPlannerSkillHandoff(
	projectDir: string,
): PlannerSkillHandoff {
	const resolvedProjectDir = resolveProjectDir(projectDir);

	return {
		actor: "codex_skill_agent",
		required_output_path: resolveSpecCandidatePath(resolvedProjectDir),
		promotion_command: "pnpm spec",
		retry_policy: "single_agent_retry_after_fail_fast",
		max_promotion_attempts: 2,
		retryable_failure_kinds: [...skillRetryableSpecPromotionFailureKinds],
		debug_paths: {
			last_invalid_candidate:
				resolveSpecCandidateLastInvalidPath(resolvedProjectDir),
			last_invalid_errors:
				resolveSpecCandidateLastErrorsPath(resolvedProjectDir),
		},
		forbidden_mutations: ["spec/deck-spec.json", "output/", "media/"],
	};
}

export function createPlannerContext(
	projectDir: string,
	sourcePrompt: string,
	options?: {
		existingSpecSummary?: ExistingSpecSummary;
		warnings?: string[];
	},
): PlannerContext {
	const resolvedProjectDir = resolveProjectDir(projectDir);

	return {
		source_prompt: sourcePrompt,
		project_slug: path.basename(resolvedProjectDir),
		paths: {
			planner_context_path: resolvePlannerContextPath(resolvedProjectDir),
			planner_brief_path: resolvePlannerBriefPath(resolvedProjectDir),
			spec_candidate_path: resolveSpecCandidatePath(resolvedProjectDir),
			canonical_spec_path: resolveDeckSpecPath(resolvedProjectDir),
			deck_spec_schema_path: resolveDeckSpecSchemaPath(resolvedProjectDir),
		},
		field_ownership: {
			planner_owned: [...plannerOwnedDeckSpecFieldPaths],
			workflow_managed: [...workflowManagedDeckSpecFieldPaths],
		},
		skill_handoff: createPlannerSkillHandoff(resolvedProjectDir),
		renderer_contract: rendererContractByLayoutIntent,
		existing_spec_summary: options?.existingSpecSummary,
		warnings: options?.warnings?.length ? [...options.warnings] : undefined,
	};
}

export function validatePlannerContextDocument(
	document: unknown,
	projectDir: string,
): {
	ok: boolean;
	errors: PlannerContextValidationError[];
} {
	const errors: PlannerContextValidationError[] = [];
	const resolvedProjectDir = resolveProjectDir(projectDir);
	const expectedProjectSlug = path.basename(resolvedProjectDir);
	const expectedPaths = createPlannerContext(
		resolvedProjectDir,
		"placeholder",
	).paths;
	const expectedSkillHandoff = createPlannerSkillHandoff(resolvedProjectDir);

	if (!isRecord(document)) {
		return {
			ok: false,
			errors: [
				{
					path: "$",
					message: "planner context must be a JSON object.",
				},
			],
		};
	}

	if (
		typeof document.source_prompt !== "string" ||
		document.source_prompt.trim().length === 0
	) {
		pushError(
			errors,
			"$.source_prompt",
			"source_prompt must be a non-empty string.",
		);
	}

	if (document.project_slug !== expectedProjectSlug) {
		pushError(
			errors,
			"$.project_slug",
			`project_slug must equal "${expectedProjectSlug}".`,
		);
	}

	if (!isRecord(document.paths)) {
		pushError(errors, "$.paths", "paths must be an object.");
	} else {
		for (const [key, expectedValue] of Object.entries(expectedPaths)) {
			if (document.paths[key] !== expectedValue) {
				pushError(
					errors,
					`$.paths.${key}`,
					`${key} must equal "${expectedValue}".`,
				);
			}
		}
	}

	if (!isRecord(document.field_ownership)) {
		pushError(
			errors,
			"$.field_ownership",
			"field_ownership must be an object.",
		);
	} else {
		if (
			!hasOnlyStrings(document.field_ownership.planner_owned) ||
			JSON.stringify(document.field_ownership.planner_owned) !==
				JSON.stringify([...plannerOwnedDeckSpecFieldPaths])
		) {
			pushError(
				errors,
				"$.field_ownership.planner_owned",
				"planner_owned must match the canonical planner-owned field list.",
			);
		}
		if (
			!hasOnlyStrings(document.field_ownership.workflow_managed) ||
			JSON.stringify(document.field_ownership.workflow_managed) !==
				JSON.stringify([...workflowManagedDeckSpecFieldPaths])
		) {
			pushError(
				errors,
				"$.field_ownership.workflow_managed",
				"workflow_managed must match the canonical workflow-managed field list.",
			);
		}
	}

	if (
		JSON.stringify(document.skill_handoff) !==
		JSON.stringify(expectedSkillHandoff)
	) {
		pushError(
			errors,
			"$.skill_handoff",
			"skill_handoff must match the canonical Codex skill handoff contract.",
		);
	}

	if (
		JSON.stringify(document.renderer_contract) !==
		JSON.stringify(rendererContractByLayoutIntent)
	) {
		pushError(
			errors,
			"$.renderer_contract",
			"renderer_contract must match the canonical renderer contract.",
		);
	}

	if (
		typeof document.warnings !== "undefined" &&
		!hasOnlyStrings(document.warnings)
	) {
		pushError(errors, "$.warnings", "warnings must be an array of strings.");
	}

	return {
		ok: errors.length === 0,
		errors,
	};
}

export function renderPlannerBriefMarkdown(context: PlannerContext): string {
	return renderPlannerBriefMarkdownCore(context);
}
