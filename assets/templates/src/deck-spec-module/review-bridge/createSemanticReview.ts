import {
	collectMaterialQualitySignals,
	type MaterialQualitySignal,
} from "../reviewing/materialQuality.js";
import {
	classifyPromptQualitySignals,
	type PromptQualitySignal,
} from "../reviewing/promptQuality.js";
import {
	calculateOverallAverage,
	calculateSectionAverage,
	deckMaterialScoreDimensionSpecs,
	imagePromptScoreDimensionSpecs,
} from "../reviewing/scorecard.js";
import type { DeckSpec } from "../../spec/contract.js";
import type {
	DeckMaterialScorecard,
	ImagePromptScorecard,
	SpecReviewFinding,
	SpecReviewResult,
	SpecReviewStatus,
} from "../../spec/reviewContract.js";

function createReviewTimestamp(): string {
	return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function mapMaterialSignalToFinding(
	signal: MaterialQualitySignal,
	index: number,
): SpecReviewFinding {
	return {
		finding_id: `${signal.id}_${index + 1}`,
		severity: signal.severity === "fail" ? "error" : "warning",
		message: signal.message,
		related_slide_ids: signal.related_slide_ids,
		related_asset_ids: signal.related_asset_ids,
	};
}

function mapPromptSignalToFinding(
	signal: PromptQualitySignal,
	index: number,
): SpecReviewFinding {
	return {
		finding_id: `${signal.id}_${index + 1}`,
		severity: signal.severity === "fail" ? "error" : "warning",
		message: signal.message,
		related_slide_ids: signal.related_slide_ids,
		related_asset_ids: signal.related_asset_ids,
	};
}

function calculateDimensionScore(
	signalCount: number,
	failCount: number,
): number {
	if (failCount > 0) {
		return 1;
	}
	if (signalCount >= 3) {
		return 2;
	}
	if (signalCount === 2) {
		return 3;
	}
	if (signalCount === 1) {
		return 4;
	}
	return 5;
}

function createDeckMaterialScorecard(
	signals: MaterialQualitySignal[],
): DeckMaterialScorecard {
	const signalCount = signals.length;
	const failCount = signals.filter(
		(signal) => signal.severity === "fail",
	).length;
	const score = calculateDimensionScore(signalCount, failCount);
	const dimensions = deckMaterialScoreDimensionSpecs.map((dimension) => ({
		id: dimension.id,
		label: dimension.label,
		score,
		rationale:
			signalCount === 0
				? "The planned deck materials stay aligned with the prompt and required workflow framing."
				: `Detected ${signalCount} material-quality signal(s) that affect deck alignment and narrative completeness.`,
		related_slide_ids: [
			...new Set(signals.flatMap((signal) => signal.related_slide_ids)),
		],
		related_asset_ids: [
			...new Set(signals.flatMap((signal) => signal.related_asset_ids)),
		],
	}));

	const sectionAverage = calculateSectionAverage(dimensions);
	return {
		dimensions,
		section_average: sectionAverage,
		overall_average: sectionAverage,
	};
}

function createImagePromptScorecard(
	signals: PromptQualitySignal[],
): ImagePromptScorecard {
	const signalCount = signals.length;
	const failCount = signals.filter(
		(signal) => signal.severity === "fail",
	).length;
	const score = calculateDimensionScore(signalCount, failCount);
	const dimensions = imagePromptScoreDimensionSpecs.map((dimension) => ({
		id: dimension.id,
		label: dimension.label,
		score,
		rationale:
			signalCount === 0
				? "Image prompt specs are concrete, safe, and aligned with slide roles."
				: `Detected ${signalCount} prompt-quality signal(s) that weaken specificity or generation safety.`,
		related_slide_ids: [
			...new Set(signals.flatMap((signal) => signal.related_slide_ids)),
		],
		related_asset_ids: [
			...new Set(signals.flatMap((signal) => signal.related_asset_ids)),
		],
	}));

	const sectionAverage = calculateSectionAverage(dimensions);
	return {
		dimensions,
		section_average: sectionAverage,
		overall_average: sectionAverage,
	};
}

function determineReviewStatus(
	materialSignals: MaterialQualitySignal[],
	promptSignals: PromptQualitySignal[],
): SpecReviewStatus {
	if (
		materialSignals.some((signal) => signal.severity === "fail") ||
		promptSignals.some((signal) => signal.severity === "fail")
	) {
		return "fail";
	}
	if (materialSignals.length > 0 || promptSignals.length > 0) {
		return "warn";
	}
	return "pass";
}

export function createDeterministicSemanticReview(
	deckSpec: DeckSpec,
): SpecReviewResult {
	const materialSignals = collectMaterialQualitySignals(
		deckSpec.source_prompt,
		deckSpec,
	);
	const promptSignals = [
		...deckSpec.asset_manifest.image_assets.flatMap((asset) =>
			classifyPromptQualitySignals(asset),
		),
		...deckSpec.asset_manifest.shared_assets.flatMap((asset) =>
			classifyPromptQualitySignals(asset),
		),
	];
	const status = determineReviewStatus(materialSignals, promptSignals);
	const deckMaterialScorecard = createDeckMaterialScorecard(materialSignals);
	const imagePromptScorecard = createImagePromptScorecard(promptSignals);
	const overallAverage = calculateOverallAverage(
		deckMaterialScorecard,
		imagePromptScorecard,
	);

	return {
		status,
		summary:
			status === "pass"
				? "Candidate canonical deck spec aligns with the prompt and satisfies the deterministic workflow checks."
				: status === "warn"
					? "Candidate canonical deck spec is publishable with warnings, but some prompt or material signals should be reviewed."
					: "Candidate canonical deck spec should not be published until the reported review failures are addressed.",
		findings: [
			...materialSignals.map(mapMaterialSignalToFinding),
			...promptSignals.map(mapPromptSignalToFinding),
		],
		missing_requirements: materialSignals
			.filter((signal) => signal.severity === "fail")
			.map((signal) => signal.message),
		drift_notes: [
			...materialSignals
				.filter((signal) => signal.severity === "warn")
				.map((signal) => signal.message),
			...promptSignals
				.filter((signal) => signal.severity === "warn")
				.map((signal) => signal.message),
		],
		recommended_actions:
			status === "fail"
				? [
						"Revise the prompt or the planning logic before publishing the canonical deck spec.",
						"Rerun semantic review after regenerating the candidate deck spec.",
					]
				: status === "warn"
					? [
							"Review the warning signals before final delivery.",
							"Proceed only if the remaining drift is acceptable for this deck.",
						]
					: [
							"Publish the canonical deck spec and continue to media generation.",
						],
		reviewed_at: createReviewTimestamp(),
		deck_material_scorecard: {
			...deckMaterialScorecard,
			overall_average: overallAverage,
		},
		image_prompt_scorecard: {
			...imagePromptScorecard,
			overall_average: overallAverage,
		},
	};
}
