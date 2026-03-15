import type {
	SpecReviewFinding,
	SpecReviewResult,
	SpecReviewScorecard,
} from "./reviewContract.js";

function renderStringList(title: string, items: string[]): string {
	const body =
		items.length === 0
			? "- None.\n"
			: items
					.map((item) => `- ${item}`)
					.join("\n")
					.concat("\n");

	return `## ${title}\n\n${body}`;
}

function renderFinding(finding: SpecReviewFinding): string {
	const lines = [`- [${finding.severity.toUpperCase()}] ${finding.message}`];

	if (finding.related_slide_ids.length > 0) {
		lines.push(`  Related slides: ${finding.related_slide_ids.join(", ")}`);
	}

	if (finding.related_asset_ids.length > 0) {
		lines.push(`  Related assets: ${finding.related_asset_ids.join(", ")}`);
	}

	return lines.join("\n");
}

function renderScorecard(
	title: string,
	scorecard: SpecReviewScorecard,
): string {
	const dimensionLines = scorecard.dimensions.map((dimension) => {
		const relatedSlides =
			dimension.related_slide_ids.length > 0
				? ` | slides: ${dimension.related_slide_ids.join(", ")}`
				: "";
		const relatedAssets =
			dimension.related_asset_ids.length > 0
				? ` | assets: ${dimension.related_asset_ids.join(", ")}`
				: "";

		return `- ${dimension.label} (\`${dimension.id}\`): ${dimension.score}/5. ${dimension.rationale}${relatedSlides}${relatedAssets}`;
	});

	return [
		`## ${title}`,
		"",
		`- Section average: ${scorecard.section_average}`,
		`- Overall average: ${scorecard.overall_average}`,
		"",
		dimensionLines.join("\n"),
	].join("\n");
}

export function renderSpecReviewMarkdown(review: SpecReviewResult): string {
	const findingsBody =
		review.findings.length === 0
			? "- None.\n"
			: review.findings.map(renderFinding).join("\n");

	return [
		"# Spec Review",
		"",
		`- Status: ${review.status.toUpperCase()}`,
		`- Reviewed At: ${review.reviewed_at}`,
		"",
		"## Summary",
		"",
		review.summary,
		"",
		renderScorecard("Deck Material Scorecard", review.deck_material_scorecard),
		"",
		renderScorecard("Image Prompt Scorecard", review.image_prompt_scorecard),
		"",
		"## Findings",
		"",
		findingsBody,
		"",
		renderStringList(
			"Missing Requirements",
			review.missing_requirements,
		).trimEnd(),
		"",
		renderStringList("Drift Notes", review.drift_notes).trimEnd(),
		"",
		renderStringList(
			"Recommended Actions",
			review.recommended_actions,
		).trimEnd(),
		"",
	].join("\n");
}
