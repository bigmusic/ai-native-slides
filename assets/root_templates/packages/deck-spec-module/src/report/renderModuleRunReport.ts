import type {
	DeckSpecPlanningDiagnostics,
	DeckSpecPlanningErrorCode,
} from "../deck-spec-module/errors.js";
import type { DeckSpecMediaPhaseArtifacts } from "../deck-spec-module/media/materializeDeckSpecMedia.js";
import type { SpecReviewResult } from "../spec/reviewContract.js";
import { renderSpecReviewMarkdown } from "../spec/renderSpecReview.js";

type RenderModuleRunReportInput = {
	ok: boolean;
	prompt: string;
	projectSlug: string;
	canonicalSpecPath: string;
	artifactRootDir: string;
	diagnostics: DeckSpecPlanningDiagnostics;
	media: DeckSpecMediaPhaseArtifacts;
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

function renderMediaSummary(media: DeckSpecMediaPhaseArtifacts): string[] {
	const lines = [
		"## Media",
		"",
		`- Enabled: ${media.enabled ? "yes" : "no"}`,
		`- Status: ${media.status.toUpperCase()}`,
	];

	if (typeof media.media_output_dir === "string") {
		lines.push(`- Media Output Dir: ${media.media_output_dir}`);
	}
	if (typeof media.final_spec_status === "string") {
		lines.push(`- Final Spec Status: ${media.final_spec_status}`);
	}
	lines.push(`- Generated Asset Count: ${media.generated_asset_ids.length}`);
	lines.push(`- Failure Count: ${media.failures.length}`);
	lines.push("");

	if (media.generated_asset_ids.length > 0) {
		lines.push(
			`- Generated Asset Ids: ${media.generated_asset_ids.join(", ")}`,
			"",
		);
	}

	if (media.failures.length > 0) {
		lines.push("### Media Failures", "");
		lines.push(
			...media.failures.map(
				(failure) => `- ${failure.asset_id}: ${failure.message}`,
			),
		);
		lines.push("");
	}

	return lines;
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

	lines.push(...renderMediaSummary(input.media));

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
