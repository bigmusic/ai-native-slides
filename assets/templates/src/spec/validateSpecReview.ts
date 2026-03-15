import type { ErrorObject } from "ajv";
import { Ajv } from "ajv";

import {
	calculateOverallAverage,
	calculateSectionAverage,
	deckMaterialScoreDimensionSpecs,
	hasCanonicalDimensionLabels,
	hasCanonicalDimensionOrder,
	imagePromptScoreDimensionSpecs,
	type ScoreDimensionSpec,
} from "../planner-agent/scorecard.js";
import type { DeckSpec } from "./contract.js";
import type {
	DeckMaterialScorecard,
	ImagePromptScorecard,
	SpecReviewResult,
	SpecReviewScorecard,
} from "./reviewContract.js";

export type SpecReviewValidationError = {
	path: string;
	message: string;
};

export type SpecReviewValidationResult = {
	ok: boolean;
	errors: SpecReviewValidationError[];
};

type ValidationContext = {
	deckSpec?: DeckSpec;
};

const scorecardSchema = {
	type: "object",
	additionalProperties: false,
	required: ["dimensions", "section_average", "overall_average"],
	properties: {
		dimensions: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"id",
					"label",
					"score",
					"rationale",
					"related_slide_ids",
					"related_asset_ids",
				],
				properties: {
					id: {
						type: "string",
						pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
					},
					label: {
						type: "string",
						minLength: 1,
					},
					score: {
						type: "integer",
						minimum: 0,
						maximum: 5,
					},
					rationale: {
						type: "string",
						minLength: 1,
					},
					related_slide_ids: {
						type: "array",
						items: {
							type: "string",
							pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
						},
					},
					related_asset_ids: {
						type: "array",
						items: {
							type: "string",
							pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
						},
					},
				},
			},
		},
		section_average: {
			type: "number",
		},
		overall_average: {
			type: "number",
		},
	},
} as const;

const reviewSchema = {
	type: "object",
	additionalProperties: false,
	required: [
		"status",
		"summary",
		"findings",
		"missing_requirements",
		"drift_notes",
		"recommended_actions",
		"reviewed_at",
		"deck_material_scorecard",
		"image_prompt_scorecard",
	],
	properties: {
		status: {
			enum: ["pass", "warn", "fail"],
		},
		summary: {
			type: "string",
			minLength: 1,
		},
		findings: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"finding_id",
					"severity",
					"message",
					"related_slide_ids",
					"related_asset_ids",
				],
				properties: {
					finding_id: {
						type: "string",
						pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
					},
					severity: {
						enum: ["info", "warning", "error"],
					},
					message: {
						type: "string",
						minLength: 1,
					},
					related_slide_ids: {
						type: "array",
						items: {
							type: "string",
							pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
						},
					},
					related_asset_ids: {
						type: "array",
						items: {
							type: "string",
							pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
						},
					},
				},
			},
		},
		missing_requirements: {
			type: "array",
			items: {
				type: "string",
				minLength: 1,
			},
		},
		drift_notes: {
			type: "array",
			items: {
				type: "string",
				minLength: 1,
			},
		},
		recommended_actions: {
			type: "array",
			items: {
				type: "string",
				minLength: 1,
			},
		},
		reviewed_at: {
			type: "string",
			pattern:
				"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?(?:Z|[+-]\\d{2}:?\\d{2})$",
		},
		deck_material_scorecard: scorecardSchema,
		image_prompt_scorecard: scorecardSchema,
	},
} as const;

function makeError(
	pathValue: string,
	message: string,
): SpecReviewValidationError {
	return {
		path: pathValue,
		message: message,
	};
}

function formatAjvErrors(errors: ErrorObject[]): SpecReviewValidationError[] {
	return errors.map((error) => ({
		path: error.instancePath === "" ? "$" : `$${error.instancePath}`,
		message: error.message ?? "Schema validation failed.",
	}));
}

function validateReferenceIds(
	deckSpec: DeckSpec,
	pathPrefix: string,
	relatedSlideIds: string[],
	relatedAssetIds: string[],
): SpecReviewValidationError[] {
	const slideIds = new Set(deckSpec.slides.map((slide) => slide.slide_id));
	const assetIds = new Set<string>([
		...deckSpec.asset_manifest.text_assets.map((asset) => asset.asset_id),
		...deckSpec.asset_manifest.image_assets.map((asset) => asset.asset_id),
		...deckSpec.asset_manifest.shared_assets.map((asset) => asset.asset_id),
	]);
	const errors: SpecReviewValidationError[] = [];

	for (const [slideIndex, slideId] of relatedSlideIds.entries()) {
		if (!slideIds.has(slideId)) {
			errors.push(
				makeError(
					`${pathPrefix}.related_slide_ids[${slideIndex}]`,
					`Referenced slide "${slideId}" does not exist in deck-spec.json.`,
				),
			);
		}
	}

	for (const [assetIndex, assetId] of relatedAssetIds.entries()) {
		if (!assetIds.has(assetId)) {
			errors.push(
				makeError(
					`${pathPrefix}.related_asset_ids[${assetIndex}]`,
					`Referenced asset "${assetId}" does not exist in deck-spec.json.`,
				),
			);
		}
	}

	return errors;
}

function validateReviewReferences(
	review: SpecReviewResult,
	deckSpec: DeckSpec,
): SpecReviewValidationError[] {
	const errors: SpecReviewValidationError[] = [];

	for (const [findingIndex, finding] of review.findings.entries()) {
		errors.push(
			...validateReferenceIds(
				deckSpec,
				`$.findings[${findingIndex}]`,
				finding.related_slide_ids,
				finding.related_asset_ids,
			),
		);
	}

	for (const [
		dimensionIndex,
		dimension,
	] of review.deck_material_scorecard.dimensions.entries()) {
		errors.push(
			...validateReferenceIds(
				deckSpec,
				`$.deck_material_scorecard.dimensions[${dimensionIndex}]`,
				dimension.related_slide_ids,
				dimension.related_asset_ids,
			),
		);
	}

	for (const [
		dimensionIndex,
		dimension,
	] of review.image_prompt_scorecard.dimensions.entries()) {
		errors.push(
			...validateReferenceIds(
				deckSpec,
				`$.image_prompt_scorecard.dimensions[${dimensionIndex}]`,
				dimension.related_slide_ids,
				dimension.related_asset_ids,
			),
		);
	}

	return errors;
}

function validateReviewStatusCoherence(
	review: SpecReviewResult,
): SpecReviewValidationError[] {
	const errors: SpecReviewValidationError[] = [];
	const hasWarningFinding = review.findings.some(
		(finding) => finding.severity === "warning",
	);
	const hasErrorFinding = review.findings.some(
		(finding) => finding.severity === "error",
	);

	switch (review.status) {
		case "pass": {
			if (review.missing_requirements.length > 0) {
				errors.push(
					makeError(
						"$.missing_requirements",
						"pass reviews must not declare missing requirements.",
					),
				);
			}
			if (review.drift_notes.length > 0) {
				errors.push(
					makeError(
						"$.drift_notes",
						"pass reviews must not declare drift notes.",
					),
				);
			}
			for (const [index, finding] of review.findings.entries()) {
				if (finding.severity !== "info") {
					errors.push(
						makeError(
							`$.findings[${index}].severity`,
							"pass reviews may only use info findings.",
						),
					);
				}
			}
			break;
		}
		case "warn": {
			if (review.missing_requirements.length > 0) {
				errors.push(
					makeError(
						"$.missing_requirements",
						"warn reviews must not declare missing requirements; use fail instead.",
					),
				);
			}
			if (hasErrorFinding) {
				errors.push(
					makeError(
						"$.findings",
						"warn reviews must not include error findings; use fail instead.",
					),
				);
			}
			if (!hasWarningFinding && review.drift_notes.length === 0) {
				errors.push(
					makeError(
						"$",
						"warn reviews must include at least one warning finding or one drift note.",
					),
				);
			}
			break;
		}
		case "fail": {
			if (!hasErrorFinding && review.missing_requirements.length === 0) {
				errors.push(
					makeError(
						"$",
						"fail reviews must include at least one missing requirement or one error finding.",
					),
				);
			}
			break;
		}
		default: {
			break;
		}
	}

	return errors;
}

function validateScorecard<DimensionId extends string>(
	scorecard: SpecReviewScorecard<DimensionId>,
	pathPrefix: string,
	specs: readonly ScoreDimensionSpec<DimensionId>[],
): SpecReviewValidationError[] {
	const errors: SpecReviewValidationError[] = [];

	if (scorecard.dimensions.length !== specs.length) {
		errors.push(
			makeError(
				`${pathPrefix}.dimensions`,
				`scorecard must contain exactly ${specs.length} dimensions.`,
			),
		);
		return errors;
	}

	if (!hasCanonicalDimensionOrder(scorecard, specs)) {
		errors.push(
			makeError(
				`${pathPrefix}.dimensions`,
				"scorecard dimensions must follow the canonical dimension order.",
			),
		);
	}

	if (!hasCanonicalDimensionLabels(scorecard, specs)) {
		errors.push(
			makeError(
				`${pathPrefix}.dimensions`,
				"scorecard dimension labels must match the canonical labels.",
			),
		);
	}

	for (const [index, dimension] of scorecard.dimensions.entries()) {
		if (dimension.score < 0 || dimension.score > 5) {
			errors.push(
				makeError(
					`${pathPrefix}.dimensions[${index}].score`,
					"score must be an integer from 0 to 5.",
				),
			);
		}
		if (!Number.isInteger(dimension.score)) {
			errors.push(
				makeError(
					`${pathPrefix}.dimensions[${index}].score`,
					"score must be an integer from 0 to 5.",
				),
			);
		}
		if (dimension.rationale.trim().length === 0) {
			errors.push(
				makeError(
					`${pathPrefix}.dimensions[${index}].rationale`,
					"rationale must be a non-empty string.",
				),
			);
		}
	}

	const expectedSectionAverage = calculateSectionAverage(scorecard.dimensions);
	if (scorecard.section_average !== expectedSectionAverage) {
		errors.push(
			makeError(
				`${pathPrefix}.section_average`,
				`section_average must equal ${expectedSectionAverage}.`,
			),
		);
	}

	return errors;
}

function validateScorecards(
	review: SpecReviewResult,
): SpecReviewValidationError[] {
	const errors: SpecReviewValidationError[] = [];

	errors.push(
		...validateScorecard(
			review.deck_material_scorecard,
			"$.deck_material_scorecard",
			deckMaterialScoreDimensionSpecs,
		),
	);
	errors.push(
		...validateScorecard(
			review.image_prompt_scorecard,
			"$.image_prompt_scorecard",
			imagePromptScoreDimensionSpecs,
		),
	);

	const expectedOverallAverage = calculateOverallAverage(
		review.deck_material_scorecard as DeckMaterialScorecard,
		review.image_prompt_scorecard as ImagePromptScorecard,
	);

	if (
		review.deck_material_scorecard.overall_average !== expectedOverallAverage
	) {
		errors.push(
			makeError(
				"$.deck_material_scorecard.overall_average",
				`overall_average must equal ${expectedOverallAverage}.`,
			),
		);
	}

	if (
		review.image_prompt_scorecard.overall_average !== expectedOverallAverage
	) {
		errors.push(
			makeError(
				"$.image_prompt_scorecard.overall_average",
				`overall_average must equal ${expectedOverallAverage}.`,
			),
		);
	}

	return errors;
}

export function validateSpecReviewDocument(
	document: unknown,
	context: ValidationContext = {},
): SpecReviewValidationResult {
	const ajv = new Ajv({
		allErrors: true,
		strict: false,
	});
	const validate = ajv.compile(reviewSchema);
	const schemaIsValid = validate(document);

	if (!schemaIsValid) {
		return {
			ok: false,
			errors: formatAjvErrors(validate.errors ?? []),
		};
	}

	const review = document as SpecReviewResult;
	const statusErrors = validateReviewStatusCoherence(review);
	const scorecardErrors = validateScorecards(review);
	const referenceErrors = context.deckSpec
		? validateReviewReferences(review, context.deckSpec)
		: [];
	const errors = [...statusErrors, ...scorecardErrors, ...referenceErrors];

	return {
		ok: errors.length === 0,
		errors: errors,
	};
}
