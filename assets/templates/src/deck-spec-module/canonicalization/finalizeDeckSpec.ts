import deckSpecSchema from "../../../spec/deck-spec.schema.json" with {
	type: "json",
};

import type { DeckSpec, DeckSpecCandidate } from "../../spec/contract.js";
import { normalizeSystemManagedFields } from "../../spec/normalizeSystemManagedFields.js";
import type { SpecReviewResult } from "../../spec/reviewContract.js";
import { validateDeckSpecDocument } from "../../spec/validateDeckSpec.js";
import { validateSpecReviewDocument } from "../../spec/validateSpecReview.js";
import {
	type DeckSpecPlanningDiagnostics,
	DeckSpecPlanningError,
	type PlanningAttemptDiagnostics,
	type PlanningAttemptStrategy,
} from "../errors.js";
import { generateDeckSpecCandidateWithGemini } from "../planning/geminiPlannerModel.js";
import {
	buildInitialPlannerPrompt,
	buildRepairPlannerPrompt,
} from "../planning/plannerPrompt.js";
import { createDeterministicSemanticReview } from "../review-bridge/createSemanticReview.js";

export type PlanDeckSpecFromPromptOptions = {
	projectSlug: string;
	generatedAt?: string;
	specVersion?: string;
	apiKey: string;
	model?: string;
	seed?: number;
	onDebugResult?: (
		result: PlanDeckSpecFromPromptDebugResult,
	) => void | Promise<void>;
};

export type PlanDeckSpecFromPromptDebugResult = {
	candidateDeckSpec: DeckSpec;
	deckSpec: DeckSpec;
	review: SpecReviewResult;
	diagnostics: DeckSpecPlanningDiagnostics;
};

const virtualProjectPrefix = "/virtual";

function createPlanningAttemptDiagnostics(
	input:
		| {
				strategy: PlanningAttemptStrategy;
				stage: "validation";
				status: "failed";
				summary: string;
				validationErrors: ReturnType<typeof validateDeckSpecDocument>["errors"];
		  }
		| {
				strategy: PlanningAttemptStrategy;
				stage: "semantic_review";
				status: "passed" | "failed";
				review: SpecReviewResult;
		  },
): PlanningAttemptDiagnostics {
	if (input.stage === "validation") {
		return {
			strategy: input.strategy,
			stage: input.stage,
			status: input.status,
			summary: input.summary,
			validation_errors: input.validationErrors,
		};
	}

	return {
		strategy: input.strategy,
		stage: input.stage,
		status: input.status,
		summary: input.review.summary,
		review_status: input.review.status,
		missing_requirements: [...input.review.missing_requirements],
		drift_notes: [...input.review.drift_notes],
	};
}

function createPlanningDiagnostics(
	attempts: PlanningAttemptDiagnostics[],
): DeckSpecPlanningDiagnostics {
	return {
		used_fallback: attempts.some((attempt) => attempt.strategy === "fallback"),
		attempts,
	};
}

function createReviewedDeckSpec(candidateDeckSpec: DeckSpec): DeckSpec {
	return {
		...candidateDeckSpec,
		status: "reviewed",
	};
}

function createPromptInvalidError(message: string): DeckSpecPlanningError {
	return new DeckSpecPlanningError({
		code: "prompt_invalid",
		message,
	});
}

function createPlanningFailureError(
	message: string,
	diagnostics: DeckSpecPlanningDiagnostics,
): DeckSpecPlanningError {
	return new DeckSpecPlanningError({
		code: "planning_failed",
		message,
		diagnostics,
	});
}

function createContractValidationError(
	message: string,
	diagnostics: DeckSpecPlanningDiagnostics,
): DeckSpecPlanningError {
	return new DeckSpecPlanningError({
		code: "contract_validation_failed",
		message,
		diagnostics,
	});
}

function createSemanticReviewError(
	message: string,
	diagnostics: DeckSpecPlanningDiagnostics,
): DeckSpecPlanningError {
	return new DeckSpecPlanningError({
		code: "semantic_review_failed",
		message,
		diagnostics,
	});
}

const geminiApiKeyEnvName = "GEMINI_API_KEY";

function resolvePlannerApiKey(options: PlanDeckSpecFromPromptOptions): string {
	if (options.apiKey.trim().length > 0) {
		return options.apiKey.trim();
	}

	throw createPlanningFailureError(
		`Missing ${geminiApiKeyEnvName}. Pass apiKey in options.`,
		createPlanningDiagnostics([]),
	);
}

function resolveProjectSlug(options: PlanDeckSpecFromPromptOptions): string {
	if (options.projectSlug.trim().length > 0) {
		return options.projectSlug.trim();
	}

	throw createPlanningFailureError(
		"Missing projectSlug. Pass projectSlug in options.",
		createPlanningDiagnostics([]),
	);
}

function normalizeCandidateDeckSpec(
	candidateDocument: unknown,
	options: PlanDeckSpecFromPromptOptions,
	sourcePrompt: string,
): DeckSpec {
	return normalizeSystemManagedFields(candidateDocument as DeckSpecCandidate, {
		projectSlug: resolveProjectSlug(options),
		sourcePrompt,
		generatedAt: options.generatedAt,
		specVersion: options.specVersion,
	});
}

function validateCanonicalDeckSpec(
	deckSpec: DeckSpec,
	projectSlug: string,
): ReturnType<typeof validateDeckSpecDocument> {
	return validateDeckSpecDocument(deckSpec, deckSpecSchema as object, {
		projectDir: `${virtualProjectPrefix}/${projectSlug}`,
	});
}

function validateSemanticReview(
	review: SpecReviewResult,
	deckSpec: DeckSpec,
): void {
	const reviewValidation = validateSpecReviewDocument(review, { deckSpec });
	if (!reviewValidation.ok) {
		throw new DeckSpecPlanningError({
			code: "planning_failed",
			message: [
				"Prompt-derived semantic review failed validation.",
				...reviewValidation.errors.map(
					(error) => `- ${error.path}: ${error.message}`,
				),
			].join("\n"),
		});
	}
}

async function runPlanningAttempt(
	strategy: PlanningAttemptStrategy,
	sourcePrompt: string,
	options: PlanDeckSpecFromPromptOptions,
	apiKey: string,
	repairInput?: {
		previousCandidate: DeckSpecCandidate;
		diagnostics: DeckSpecPlanningDiagnostics;
	},
): Promise<{
	candidateDocument: DeckSpecCandidate;
	candidateDeckSpec: DeckSpec;
	review?: SpecReviewResult;
	attemptDiagnostics: PlanningAttemptDiagnostics;
}> {
	const plannerPrompt =
		strategy === "primary"
			? buildInitialPlannerPrompt(sourcePrompt)
			: buildRepairPlannerPrompt({
					sourcePrompt,
					previousCandidate:
						repairInput?.previousCandidate ?? ({} as DeckSpecCandidate),
					diagnostics:
						repairInput?.diagnostics ?? createPlanningDiagnostics([]),
				});
	const candidateDocument = (await generateDeckSpecCandidateWithGemini({
		apiKey,
		prompt: plannerPrompt,
		model: options.model,
		seed: options.seed,
	})) as DeckSpecCandidate;
	const candidateDeckSpec = normalizeCandidateDeckSpec(
		candidateDocument,
		options,
		sourcePrompt,
	);
	const validationResult = validateCanonicalDeckSpec(
		candidateDeckSpec,
		resolveProjectSlug(options),
	);

	if (!validationResult.ok) {
		return {
			candidateDocument,
			candidateDeckSpec,
			attemptDiagnostics: createPlanningAttemptDiagnostics({
				strategy,
				stage: "validation",
				status: "failed",
				summary:
					"Candidate deck-spec failed canonical validation before semantic review.",
				validationErrors: validationResult.errors,
			}),
		};
	}

	const review = createDeterministicSemanticReview(candidateDeckSpec);
	validateSemanticReview(review, candidateDeckSpec);

	return {
		candidateDocument,
		candidateDeckSpec,
		review,
		attemptDiagnostics: createPlanningAttemptDiagnostics({
			strategy,
			stage: "semantic_review",
			status: review.status === "fail" ? "failed" : "passed",
			review,
		}),
	};
}

async function planDeckSpecFromPromptDetailed(
	prompt: string,
	options: PlanDeckSpecFromPromptOptions,
): Promise<PlanDeckSpecFromPromptDebugResult> {
	const trimmedPrompt = prompt.trim();
	if (trimmedPrompt.length < 16) {
		throw createPromptInvalidError(
			"Prompt is too short to derive a canonical deck spec. Provide a fuller user prompt.",
		);
	}

	const apiKey = resolvePlannerApiKey(options);
	const attempts: PlanningAttemptDiagnostics[] = [];

	try {
		const primary = await runPlanningAttempt(
			"primary",
			trimmedPrompt,
			options,
			apiKey,
		);
		attempts.push(primary.attemptDiagnostics);

		if (primary.attemptDiagnostics.status === "passed") {
			return {
				candidateDeckSpec: primary.candidateDeckSpec,
				deckSpec: createReviewedDeckSpec(primary.candidateDeckSpec),
				review:
					primary.review ??
					createDeterministicSemanticReview(primary.candidateDeckSpec),
				diagnostics: createPlanningDiagnostics(attempts),
			};
		}

		const fallback = await runPlanningAttempt(
			"fallback",
			trimmedPrompt,
			options,
			apiKey,
			{
				previousCandidate: primary.candidateDocument,
				diagnostics: createPlanningDiagnostics(attempts),
			},
		);
		attempts.push(fallback.attemptDiagnostics);

		if (fallback.attemptDiagnostics.status === "passed") {
			return {
				candidateDeckSpec: fallback.candidateDeckSpec,
				deckSpec: createReviewedDeckSpec(fallback.candidateDeckSpec),
				review:
					fallback.review ??
					createDeterministicSemanticReview(fallback.candidateDeckSpec),
				diagnostics: createPlanningDiagnostics(attempts),
			};
		}

		const diagnostics = createPlanningDiagnostics(attempts);
		if (attempts.some((attempt) => attempt.stage === "validation")) {
			throw createContractValidationError(
				"Planner model returned candidates that failed canonical validation after the internal repair attempt.",
				diagnostics,
			);
		}

		throw createSemanticReviewError(
			"Planner model returned candidates that failed semantic review after the internal repair attempt.",
			diagnostics,
		);
	} catch (error) {
		if (error instanceof DeckSpecPlanningError) {
			throw error;
		}

		throw createPlanningFailureError(
			error instanceof Error
				? error.message
				: `Unknown planner failure: ${String(error)}`,
			createPlanningDiagnostics(attempts),
		);
	}
}

export async function planDeckSpecFromPrompt(
	prompt: string,
	options: PlanDeckSpecFromPromptOptions,
): Promise<DeckSpec> {
	const result = await planDeckSpecFromPromptDetailed(prompt, options);
	await options.onDebugResult?.(result);
	return result.deckSpec;
}
