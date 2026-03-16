import type { SpecReviewResult } from "../spec/reviewContract.js";
import type { DeckSpecValidationError } from "../spec/validateDeckSpec.js";

export const deckSpecPlanningErrorCodes = [
	"prompt_invalid",
	"planning_failed",
	"semantic_review_failed",
	"contract_validation_failed",
	"media_generation_failed",
] as const;

export type DeckSpecPlanningErrorCode =
	(typeof deckSpecPlanningErrorCodes)[number];

export const planningAttemptStrategyValues = ["primary", "fallback"] as const;
export type PlanningAttemptStrategy =
	(typeof planningAttemptStrategyValues)[number];

export type PlanningAttemptDiagnostics = {
	strategy: PlanningAttemptStrategy;
	stage: "validation" | "semantic_review";
	status: "passed" | "failed";
	summary: string;
	review_status?: SpecReviewResult["status"];
	missing_requirements?: string[];
	drift_notes?: string[];
	validation_errors?: DeckSpecValidationError[];
};

export type DeckSpecPlanningDiagnostics = {
	used_fallback: boolean;
	attempts: PlanningAttemptDiagnostics[];
};

export class DeckSpecPlanningError extends Error {
	override name = "DeckSpecPlanningError";
	readonly code: DeckSpecPlanningErrorCode;
	readonly diagnostics: DeckSpecPlanningDiagnostics;

	constructor(input: {
		code: DeckSpecPlanningErrorCode;
		message: string;
		diagnostics?: DeckSpecPlanningDiagnostics;
	}) {
		super(input.message);
		this.code = input.code;
		this.diagnostics = input.diagnostics ?? {
			used_fallback: false,
			attempts: [],
		};
	}
}

export function isDeckSpecPlanningError(
	error: unknown,
): error is DeckSpecPlanningError {
	return error instanceof DeckSpecPlanningError;
}
