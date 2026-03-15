import type {
	DeckSpecPlanningDiagnostics,
	DeckSpecPlanningErrorCode,
} from "../deck-spec-module/errors.js";
import type { SpecReviewResult } from "../spec/reviewContract.js";
import { renderSpecReviewMarkdown } from "../spec/renderSpecReview.js";

type RenderModuleRunReportInput = {
	ok: boolean;
	prompt: string;
	projectSlug: string;
	canonicalSpecPath: string;
	artifactRootDir: string;
	diagnostics: DeckSpecPlanningDiagnostics;
	review?: SpecReviewResult;
	error?: {
		code: DeckSpecPlanningErrorCode | "unexpected_error";
		message: string;
	};
};

function renderAttemptSummary(
	diagnostics: DeckSpecPlanningDiagnostics,
): string {
	if (diagnostics.attempts.length === 0) {
		return "- None.";
	}

	return diagnostics.attempts
		.map(
			(attempt, index) =>
				`- Attempt ${index + 1}: ${attempt.strategy} / ${attempt.stage} / ${attempt.status} - ${attempt.summary}`,
		)
		.join("\n");
}

export function renderModuleRunReport(
	input: RenderModuleRunReportInput,
): string {
	const lines = [
		"# Deck-Spec Module Run",
		"",
		`- Status: ${input.ok ? "SUCCESS" : "FAILED"}`,
		`- Project Slug: ${input.projectSlug}`,
		`- Canonical Spec Path: ${input.canonicalSpecPath}`,
		`- Artifact Root Dir: ${input.artifactRootDir}`,
		`- Used Fallback: ${input.diagnostics.used_fallback ? "yes" : "no"}`,
		"",
		"## Prompt",
		"",
		input.prompt,
		"",
		"## Attempts",
		"",
		renderAttemptSummary(input.diagnostics),
		"",
	];

	if (input.error) {
		lines.push("## Failure", "");
		lines.push(`- Code: ${input.error.code}`);
		lines.push(`- Message: ${input.error.message}`);
		lines.push("");
	}

	if (input.review) {
		lines.push(renderSpecReviewMarkdown(input.review));
		lines.push("");
	}

	return lines.join("\n");
}
