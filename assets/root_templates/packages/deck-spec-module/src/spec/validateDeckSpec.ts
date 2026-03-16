import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Ajv, type ErrorObject } from "ajv";

import type {
	ContentBlock,
	DeckImageAsset,
	DeckSpec,
	SharedVisualAsset,
	SlideMapping,
	TextAsset,
} from "./contract.js";
import { deriveOutputFileName } from "./deriveOutputFileName.js";
import {
	readDeckSpec,
	readJsonFile,
	readDeckSpecSchema,
	resolveDeckSpecPath,
	resolveDeckSpecSchemaPath,
	resolveProjectDir,
} from "./readDeckSpec.js";
import {
	type RendererSlotContract,
	rendererContractByLayoutIntent,
} from "./rendererContract.js";

export type DeckSpecValidationError = {
	path: string;
	message: string;
};

export type DeckSpecValidationResult = {
	ok: boolean;
	errors: DeckSpecValidationError[];
};

export type CliIo = {
	stdout: (message: string) => void;
	stderr: (message: string) => void;
};

type ValidationContext = {
	projectDir?: string;
	projectSlug?: string;
};

type ReferenceSets = {
	text: Set<string>;
	image: Set<string>;
	shared: Set<string>;
};

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};
const packageRootDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);
const bundledDeckSpecSchemaPath = path.join(
	packageRootDir,
	"spec",
	"deck-spec.schema.json",
);

function makeError(
	pathValue: string,
	message: string,
): DeckSpecValidationError {
	return {
		path: pathValue,
		message,
	};
}

function formatAjvErrors(errors: ErrorObject[]): DeckSpecValidationError[] {
	return errors.map((error) => ({
		path: error.instancePath === "" ? "$" : `$${error.instancePath}`,
		message: error.message ?? "Schema validation failed.",
	}));
}

function recordUniqueValue(
	seenValues: Set<string>,
	value: string,
	pathValue: string,
	label: string,
	errors: DeckSpecValidationError[],
): void {
	if (seenValues.has(value)) {
		errors.push(makeError(pathValue, `Duplicate ${label} "${value}".`));
		return;
	}
	seenValues.add(value);
}

function recordArrayDuplicates(
	values: string[],
	pathValue: string,
	label: string,
	errors: DeckSpecValidationError[],
): void {
	const seenValues = new Set<string>();
	for (const value of values) {
		if (seenValues.has(value)) {
			errors.push(makeError(pathValue, `Duplicate ${label} "${value}".`));
			continue;
		}
		seenValues.add(value);
	}
}

function compareReferenceSet(
	expectedValues: string[],
	actualValues: Set<string>,
	pathValue: string,
	label: string,
	errors: DeckSpecValidationError[],
): void {
	const expectedSet = new Set(expectedValues);
	const extras = [...expectedSet].filter((value) => !actualValues.has(value));
	const missing = [...actualValues].filter((value) => !expectedSet.has(value));

	if (extras.length > 0) {
		errors.push(
			makeError(
				pathValue,
				`${label} includes entries that are not referenced by content_blocks: ${extras.join(", ")}.`,
			),
		);
	}

	if (missing.length > 0) {
		errors.push(
			makeError(
				pathValue,
				`${label} is missing content_blocks references: ${missing.join(", ")}.`,
			),
		);
	}
}

function ensureTextAssetKind(
	asset: TextAsset | undefined,
	assetId: string,
	expectedKind: TextAsset["text_kind"],
	pathValue: string,
	errors: DeckSpecValidationError[],
	referenceCounts: Map<string, number>,
): void {
	if (!asset) {
		errors.push(
			makeError(
				pathValue,
				`Referenced text asset "${assetId}" does not exist.`,
			),
		);
		return;
	}

	if (asset.text_kind !== expectedKind) {
		errors.push(
			makeError(
				pathValue,
				`Text asset "${assetId}" must be "${expectedKind}", received "${asset.text_kind}".`,
			),
		);
		return;
	}

	referenceCounts.set(assetId, (referenceCounts.get(assetId) ?? 0) + 1);
}

function collectBlockReferences(
	block: ContentBlock,
	slideId: string,
	pathValue: string,
	textAssetsById: Map<string, TextAsset>,
	imageAssetsById: Map<string, DeckImageAsset>,
	sharedAssetsById: Map<string, SharedVisualAsset>,
	referenceSets: ReferenceSets,
	errors: DeckSpecValidationError[],
	textReferenceCounts: Map<string, number>,
	imageReferenceCounts: Map<string, number>,
	sharedReferenceCounts: Map<string, number>,
): void {
	switch (block.block_type) {
		case "text":
		case "badge":
		case "callout":
			referenceSets.text.add(block.text_asset_id);
			ensureTextAssetKind(
				textAssetsById.get(block.text_asset_id),
				block.text_asset_id,
				"plain_text",
				`${pathValue}/text_asset_id`,
				errors,
				textReferenceCounts,
			);
			return;
		case "bullet_list":
			referenceSets.text.add(block.text_asset_id);
			ensureTextAssetKind(
				textAssetsById.get(block.text_asset_id),
				block.text_asset_id,
				"bullet_list",
				`${pathValue}/text_asset_id`,
				errors,
				textReferenceCounts,
			);
			return;
		case "card":
			referenceSets.text.add(block.title_asset_id);
			referenceSets.text.add(block.body_asset_id);
			ensureTextAssetKind(
				textAssetsById.get(block.title_asset_id),
				block.title_asset_id,
				"plain_text",
				`${pathValue}/title_asset_id`,
				errors,
				textReferenceCounts,
			);
			ensureTextAssetKind(
				textAssetsById.get(block.body_asset_id),
				block.body_asset_id,
				"plain_text",
				`${pathValue}/body_asset_id`,
				errors,
				textReferenceCounts,
			);
			return;
		case "metric":
			referenceSets.text.add(block.value_asset_id);
			referenceSets.text.add(block.label_asset_id);
			ensureTextAssetKind(
				textAssetsById.get(block.value_asset_id),
				block.value_asset_id,
				"plain_text",
				`${pathValue}/value_asset_id`,
				errors,
				textReferenceCounts,
			);
			ensureTextAssetKind(
				textAssetsById.get(block.label_asset_id),
				block.label_asset_id,
				"plain_text",
				`${pathValue}/label_asset_id`,
				errors,
				textReferenceCounts,
			);
			return;
		case "image":
			if ("image_asset_id" in block) {
				referenceSets.image.add(block.image_asset_id);
				const imageAsset = imageAssetsById.get(block.image_asset_id);
				if (!imageAsset) {
					errors.push(
						makeError(
							`${pathValue}/image_asset_id`,
							`Referenced image asset "${block.image_asset_id}" does not exist.`,
						),
					);
					return;
				}
				if (imageAsset.slide_id !== slideId) {
					errors.push(
						makeError(
							`${pathValue}/image_asset_id`,
							`Image asset "${block.image_asset_id}" belongs to slide "${imageAsset.slide_id}", not "${slideId}".`,
						),
					);
				}
				imageReferenceCounts.set(
					block.image_asset_id,
					(imageReferenceCounts.get(block.image_asset_id) ?? 0) + 1,
				);
				return;
			}

			referenceSets.shared.add(block.shared_asset_id);
			if (!sharedAssetsById.has(block.shared_asset_id)) {
				errors.push(
					makeError(
						`${pathValue}/shared_asset_id`,
						`Referenced shared asset "${block.shared_asset_id}" does not exist.`,
					),
				);
				return;
			}
			sharedReferenceCounts.set(
				block.shared_asset_id,
				(sharedReferenceCounts.get(block.shared_asset_id) ?? 0) + 1,
			);
			return;
	}
}

function validateRendererContractForSlide(
	plan: DeckSpec,
	slideIndex: number,
	errors: DeckSpecValidationError[],
): void {
	const slide = plan.slides[slideIndex];
	const contract = rendererContractByLayoutIntent[
		slide.layout_intent
	] as Record<string, RendererSlotContract>;
	if (!contract) {
		errors.push(
			makeError(
				`$.slides[${slideIndex}].layout_intent`,
				`Layout intent "${slide.layout_intent}" is not supported by the renderer contract.`,
			),
		);
		return;
	}

	const seenSlots = new Set<string>();

	for (const [blockIndex, block] of slide.content_blocks.entries()) {
		const pathValue = `$.slides[${slideIndex}].content_blocks[${blockIndex}].layout_slot`;
		const slotContract = contract[block.layout_slot];

		if (!slotContract) {
			errors.push(
				makeError(
					pathValue,
					`layout_slot "${block.layout_slot}" is not allowed for layout_intent "${slide.layout_intent}".`,
				),
			);
			continue;
		}

		if (!slotContract.allowedBlockTypes.includes(block.block_type)) {
			errors.push(
				makeError(
					pathValue,
					`layout_slot "${block.layout_slot}" on layout_intent "${slide.layout_intent}" only accepts ${slotContract.allowedBlockTypes.join(" or ")}, received "${block.block_type}".`,
				),
			);
		}

		if (seenSlots.has(block.layout_slot)) {
			errors.push(
				makeError(
					pathValue,
					`layout_slot "${block.layout_slot}" can only appear once on layout_intent "${slide.layout_intent}".`,
				),
			);
			continue;
		}

		seenSlots.add(block.layout_slot);
	}

	for (const [slotName, slotContract] of Object.entries(contract)) {
		if (slotContract.required && !seenSlots.has(slotName)) {
			errors.push(
				makeError(
					`$.slides[${slideIndex}].content_blocks`,
					`layout_intent "${slide.layout_intent}" requires layout_slot "${slotName}".`,
				),
			);
		}
	}
}

function validateDeckSpecRules(
	plan: DeckSpec,
	context: ValidationContext,
): DeckSpecValidationError[] {
	const errors: DeckSpecValidationError[] = [];
	const projectSlugFromContext =
		typeof context.projectSlug === "string" && context.projectSlug.trim() !== ""
			? context.projectSlug
			: typeof context.projectDir === "string" &&
				  context.projectDir.trim() !== ""
				? path.basename(context.projectDir)
				: plan.project_slug;

	if (plan.target_slide_count !== plan.slides.length) {
		errors.push(
			makeError(
				"$.target_slide_count",
				`target_slide_count must equal slides.length (${plan.slides.length}).`,
			),
		);
	}

	if (plan.project_slug !== projectSlugFromContext) {
		errors.push(
			makeError(
				"$.project_slug",
				`project_slug must match the project directory basename "${projectSlugFromContext}".`,
			),
		);
	}

	const seenAssetIds = new Set<string>();
	const seenSlideIds = new Set<string>();
	const seenBlockIds = new Set<string>();
	const seenMappingSlideIds = new Set<string>();

	const textAssetsById = new Map<string, TextAsset>();
	const imageAssetsById = new Map<string, DeckImageAsset>();
	const sharedAssetsById = new Map<string, SharedVisualAsset>();

	for (const [index, asset] of plan.asset_manifest.text_assets.entries()) {
		recordUniqueValue(
			seenAssetIds,
			asset.asset_id,
			`$.asset_manifest.text_assets[${index}].asset_id`,
			"asset_id",
			errors,
		);
		textAssetsById.set(asset.asset_id, asset);
	}

	for (const [index, asset] of plan.asset_manifest.image_assets.entries()) {
		recordUniqueValue(
			seenAssetIds,
			asset.asset_id,
			`$.asset_manifest.image_assets[${index}].asset_id`,
			"asset_id",
			errors,
		);
		if (deriveOutputFileName(asset) !== asset.output_file_name) {
			errors.push(
				makeError(
					`$.asset_manifest.image_assets[${index}].output_file_name`,
					`output_file_name must equal "${deriveOutputFileName(asset)}".`,
				),
			);
		}
		imageAssetsById.set(asset.asset_id, asset);
	}

	for (const [index, asset] of plan.asset_manifest.shared_assets.entries()) {
		recordUniqueValue(
			seenAssetIds,
			asset.asset_id,
			`$.asset_manifest.shared_assets[${index}].asset_id`,
			"asset_id",
			errors,
		);
		if (deriveOutputFileName(asset) !== asset.output_file_name) {
			errors.push(
				makeError(
					`$.asset_manifest.shared_assets[${index}].output_file_name`,
					`output_file_name must equal "${deriveOutputFileName(asset)}".`,
				),
			);
		}
		sharedAssetsById.set(asset.asset_id, asset);
	}

	for (const [index, slide] of plan.slides.entries()) {
		recordUniqueValue(
			seenSlideIds,
			slide.slide_id,
			`$.slides[${index}].slide_id`,
			"slide_id",
			errors,
		);

		for (const [blockIndex, block] of slide.content_blocks.entries()) {
			recordUniqueValue(
				seenBlockIds,
				block.block_id,
				`$.slides[${index}].content_blocks[${blockIndex}].block_id`,
				"block_id",
				errors,
			);
		}

		validateRendererContractForSlide(plan, index, errors);
	}

	for (const [index, mapping] of plan.slide_mapping.entries()) {
		recordUniqueValue(
			seenMappingSlideIds,
			mapping.slide_id,
			`$.slide_mapping[${index}].slide_id`,
			"slide_mapping.slide_id",
			errors,
		);
		recordArrayDuplicates(
			mapping.text_asset_ids,
			`$.slide_mapping[${index}].text_asset_ids`,
			"text_asset_id",
			errors,
		);
		recordArrayDuplicates(
			mapping.image_asset_ids,
			`$.slide_mapping[${index}].image_asset_ids`,
			"image_asset_id",
			errors,
		);
		recordArrayDuplicates(
			mapping.shared_asset_ids,
			`$.slide_mapping[${index}].shared_asset_ids`,
			"shared_asset_id",
			errors,
		);
	}

	for (const [index, asset] of plan.asset_manifest.image_assets.entries()) {
		if (!seenSlideIds.has(asset.slide_id)) {
			errors.push(
				makeError(
					`$.asset_manifest.image_assets[${index}].slide_id`,
					`Referenced slide "${asset.slide_id}" does not exist.`,
				),
			);
		}
	}

	const mappingBySlideId = new Map<string, SlideMapping>(
		plan.slide_mapping.map((mapping) => [mapping.slide_id, mapping]),
	);
	const textReferenceCounts = new Map<string, number>();
	const imageReferenceCounts = new Map<string, number>();
	const sharedReferenceCounts = new Map<string, number>();

	for (const [slideIndex, slide] of plan.slides.entries()) {
		const mapping = mappingBySlideId.get(slide.slide_id);
		if (!mapping) {
			errors.push(
				makeError(
					`$.slide_mapping`,
					`slide_mapping is missing an entry for slide "${slide.slide_id}".`,
				),
			);
			continue;
		}

		const referenceSets: ReferenceSets = {
			text: new Set<string>(),
			image: new Set<string>(),
			shared: new Set<string>(),
		};

		for (const [blockIndex, block] of slide.content_blocks.entries()) {
			collectBlockReferences(
				block,
				slide.slide_id,
				`$.slides[${slideIndex}].content_blocks[${blockIndex}]`,
				textAssetsById,
				imageAssetsById,
				sharedAssetsById,
				referenceSets,
				errors,
				textReferenceCounts,
				imageReferenceCounts,
				sharedReferenceCounts,
			);
		}

		compareReferenceSet(
			mapping.text_asset_ids,
			referenceSets.text,
			`$.slide_mapping[${plan.slide_mapping.findIndex((item) => item.slide_id === slide.slide_id)}].text_asset_ids`,
			"text_asset_ids",
			errors,
		);
		compareReferenceSet(
			mapping.image_asset_ids,
			referenceSets.image,
			`$.slide_mapping[${plan.slide_mapping.findIndex((item) => item.slide_id === slide.slide_id)}].image_asset_ids`,
			"image_asset_ids",
			errors,
		);
		compareReferenceSet(
			mapping.shared_asset_ids,
			referenceSets.shared,
			`$.slide_mapping[${plan.slide_mapping.findIndex((item) => item.slide_id === slide.slide_id)}].shared_asset_ids`,
			"shared_asset_ids",
			errors,
		);
	}

	for (const mapping of plan.slide_mapping) {
		if (!seenSlideIds.has(mapping.slide_id)) {
			errors.push(
				makeError(
					"$.slide_mapping",
					`slide_mapping references unknown slide "${mapping.slide_id}".`,
				),
			);
		}
	}

	for (const asset of plan.asset_manifest.text_assets) {
		if (asset.required && !textReferenceCounts.has(asset.asset_id)) {
			errors.push(
				makeError(
					"$.asset_manifest.text_assets",
					`Required text asset "${asset.asset_id}" is not referenced by any content block.`,
				),
			);
		}
	}

	for (const asset of plan.asset_manifest.image_assets) {
		if (asset.required && !imageReferenceCounts.has(asset.asset_id)) {
			errors.push(
				makeError(
					"$.asset_manifest.image_assets",
					`Required image asset "${asset.asset_id}" is not referenced by any content block.`,
				),
			);
		}
	}

	for (const asset of plan.asset_manifest.shared_assets) {
		if (asset.required && !sharedReferenceCounts.has(asset.asset_id)) {
			errors.push(
				makeError(
					"$.asset_manifest.shared_assets",
					`Required shared asset "${asset.asset_id}" is not referenced by any content block.`,
				),
			);
		}
	}

	return errors;
}

export function validateDeckSpecDocument(
	document: unknown,
	schema: object,
	context: ValidationContext,
): DeckSpecValidationResult {
	const ajv = new Ajv({
		allErrors: true,
		strict: false,
	});
	const validate = ajv.compile(schema);
	const schemaIsValid = validate(document);

	if (!schemaIsValid) {
		return {
			ok: false,
			errors: formatAjvErrors(validate.errors ?? []),
		};
	}

	const ruleErrors = validateDeckSpecRules(document as DeckSpec, context);
	return {
		ok: ruleErrors.length === 0,
		errors: ruleErrors,
	};
}

export async function validateDeckSpecFile(
	projectDir: string,
): Promise<DeckSpecValidationResult> {
	const [schema, deckSpec] = await Promise.all([
		readDeckSpecSchema(projectDir),
		readDeckSpec(projectDir),
	]);

	return validateDeckSpecDocument(deckSpec, schema as object, { projectDir });
}

export async function validateDeckSpecFileFromPath(
	canonicalSpecPath: string,
): Promise<DeckSpecValidationResult> {
	const [schema, deckSpec] = await Promise.all([
		readJsonFile(bundledDeckSpecSchemaPath, "deck-spec.schema.json"),
		readJsonFile(canonicalSpecPath, "deck-spec.json"),
	]);
	const projectDir = path.resolve(path.dirname(canonicalSpecPath), "..");
	const projectSlug =
		typeof deckSpec === "object" &&
		deckSpec !== null &&
		"project_slug" in deckSpec &&
		typeof (deckSpec as { project_slug?: unknown }).project_slug === "string"
			? (deckSpec as { project_slug: string }).project_slug
			: undefined;

	return validateDeckSpecDocument(deckSpec, schema as object, {
		projectDir,
		projectSlug,
	});
}

export async function runSpecValidateCli(
	args: string[],
	io: CliIo = defaultCliIo,
): Promise<number> {
	const projectDir = resolveProjectDir(args[0]);
	const specPath = resolveDeckSpecPath(projectDir);
	const schemaPath = resolveDeckSpecSchemaPath(projectDir);

	try {
		const result = await validateDeckSpecFile(projectDir);
		if (result.ok) {
			io.stdout(`Deck spec is valid: ${specPath}`);
			io.stdout(`Schema source: ${schemaPath}`);
			return 0;
		}

		io.stderr(`Deck spec validation failed: ${specPath}`);
		io.stderr(`Schema source: ${schemaPath}`);
		for (const error of result.errors) {
			io.stderr(`- ${error.path}: ${error.message}`);
		}
		return 1;
	} catch (error) {
		io.stderr(getCliErrorMessage(error));
		return 1;
	}
}

function getCliErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: `Unknown error: ${String(error)}`;
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runSpecValidateCli(process.argv.slice(2));
	process.exit(exitCode);
}
