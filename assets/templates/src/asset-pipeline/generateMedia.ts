import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolveGeminiApiKey } from "../planner-agent/image-generation/env.js";
import {
	type GeneratedImage,
	type GenerateGeminiImageRequest,
	generateImageWithGemini,
} from "../planner-agent/image-generation/geminiAdapter.js";
import {
	compileProviderImagePrompt,
	type PlannedImageAsset,
} from "../planner-agent/prompt-quality.js";
import type {
	DeckImageAsset,
	DeckSpec,
	ImageAssetStatus,
	SharedVisualAsset,
} from "../spec/contract.js";
import {
	readDeckSpec,
	resolveDeckSpecPath,
	resolveProjectDir,
} from "../spec/readDeckSpec.js";
import {
	type CliIo as DeckSpecCliIo,
	validateDeckSpecFile,
} from "../spec/validateDeckSpec.js";
import {
	writeBufferFileAtomic,
	writeJsonFileAtomic,
} from "../spec/writeFileAtomic.js";
import { normalizeGeneratedImage } from "./imagePolicy.js";
import {
	resolveGeneratedImageAssetPath,
	resolveGeneratedImageAssetsDir,
} from "./paths.js";

type AssetFailure = {
	assetId: string;
	message: string;
};

type RequiredImageAsset = DeckImageAsset | SharedVisualAsset;

type GenerateImageFn = (
	request: GenerateGeminiImageRequest,
) => Promise<GeneratedImage>;

export type GenerateMediaDependencies = {
	processEnv?: NodeJS.ProcessEnv;
	generateImage?: GenerateImageFn;
};

type GenerateMediaResult =
	| {
			ok: true;
			specPath: string;
			generatedDir: string;
			generatedAssetIds: string[];
	  }
	| {
			ok: false;
			specPath: string;
			generatedDir: string;
			generatedAssetIds: string[];
			failures: AssetFailure[];
			message?: string;
			validationErrors?: Array<{
				path: string;
				message: string;
			}>;
	  };

const defaultCliIo: DeckSpecCliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function collectRequiredAssets(plan: DeckSpec): RequiredImageAsset[] {
	return [
		...plan.asset_manifest.image_assets,
		...plan.asset_manifest.shared_assets,
	].filter((asset) => asset.required);
}

function updateStatusFromFile(
	status: ImageAssetStatus,
	fileExists: boolean,
): ImageAssetStatus {
	if (!fileExists) {
		return status;
	}

	return status === "planned" ? "generated" : status;
}

function updateSpecWithGeneratedMedia(
	spec: DeckSpec,
	projectDir: string,
): DeckSpec {
	const imageAssets = spec.asset_manifest.image_assets.map((asset) => {
		const fileExists = existsSync(
			resolveGeneratedImageAssetPath(projectDir, asset.output_file_name),
		);
		return {
			...asset,
			status: updateStatusFromFile(asset.status, fileExists),
		};
	});
	const sharedAssets = spec.asset_manifest.shared_assets.map((asset) => {
		const fileExists = existsSync(
			resolveGeneratedImageAssetPath(projectDir, asset.output_file_name),
		);
		return {
			...asset,
			status: updateStatusFromFile(asset.status, fileExists),
		};
	});
	const allRequiredFilesExist = [...imageAssets, ...sharedAssets]
		.filter((asset) => asset.required)
		.every((asset) =>
			existsSync(
				resolveGeneratedImageAssetPath(projectDir, asset.output_file_name),
			),
		);

	return {
		...spec,
		status: allRequiredFilesExist ? "media_ready" : "reviewed",
		asset_manifest: {
			...spec.asset_manifest,
			image_assets: imageAssets,
			shared_assets: sharedAssets,
		},
	};
}

async function generateAndWriteAsset(
	projectDir: string,
	apiKey: string,
	asset: PlannedImageAsset,
	generateImage: GenerateImageFn,
): Promise<void> {
	const prompt = compileProviderImagePrompt(asset);
	const generatedImage = await generateImage({
		apiKey,
		prompt,
		aspectRatio: asset.aspect_ratio,
	});
	const normalizedImage = await normalizeGeneratedImage({
		sourceBuffer: generatedImage.imageBytes,
		outputFormat: asset.output_format,
		sizeTier: asset.size_tier,
		aspectRatio: asset.aspect_ratio,
		intendedUsage: asset.intended_usage,
	});

	await writeBufferFileAtomic(
		resolveGeneratedImageAssetPath(projectDir, asset.output_file_name),
		normalizedImage,
	);
}

export async function generateProjectMedia(
	projectDir: string,
	dependencies: GenerateMediaDependencies = {},
): Promise<GenerateMediaResult> {
	const resolvedProjectDir = resolveProjectDir(projectDir);
	const specPath = resolveDeckSpecPath(resolvedProjectDir);
	const generatedDir = resolveGeneratedImageAssetsDir(resolvedProjectDir);
	const generateImage = dependencies.generateImage ?? generateImageWithGemini;

	try {
		const validation = await validateDeckSpecFile(resolvedProjectDir);
		if (!validation.ok) {
			return {
				ok: false,
				specPath,
				generatedDir,
				generatedAssetIds: [],
				failures: [],
				validationErrors: validation.errors,
			};
		}

		const deckSpec = (await readDeckSpec(resolvedProjectDir)) as DeckSpec;
		if (deckSpec.status !== "reviewed" && deckSpec.status !== "media_ready") {
			return {
				ok: false,
				specPath,
				generatedDir,
				generatedAssetIds: [],
				failures: [],
				message:
					"pnpm media requires deck-spec.json.status to be `reviewed` or `media_ready`.",
			};
		}

		const requiredAssets = collectRequiredAssets(deckSpec);
		await mkdir(generatedDir, { recursive: true });

		if (requiredAssets.length === 0) {
			const updatedPlan = {
				...deckSpec,
				status: "media_ready" as const,
			};
			await writeJsonFileAtomic(specPath, updatedPlan);
			return {
				ok: true,
				specPath,
				generatedDir,
				generatedAssetIds: [],
			};
		}

		const { apiKey } = await resolveGeminiApiKey(resolvedProjectDir, {
			processEnv: dependencies.processEnv,
		});
		const generatedAssetIds: string[] = [];
		const failures: AssetFailure[] = [];

		for (const asset of requiredAssets) {
			try {
				await generateAndWriteAsset(
					resolvedProjectDir,
					apiKey,
					asset,
					generateImage,
				);
				generatedAssetIds.push(asset.asset_id);
			} catch (error) {
				failures.push({
					assetId: asset.asset_id,
					message: getErrorMessage(error),
				});
			}
		}

		const reloadedPlan = (await readDeckSpec(resolvedProjectDir)) as DeckSpec;
		const updatedPlan = updateSpecWithGeneratedMedia(
			reloadedPlan,
			resolvedProjectDir,
		);
		await writeJsonFileAtomic(specPath, updatedPlan);

		if (failures.length > 0) {
			return {
				ok: false,
				specPath,
				generatedDir,
				generatedAssetIds,
				failures,
			};
		}

		return {
			ok: true,
			specPath,
			generatedDir,
			generatedAssetIds,
		};
	} catch (error) {
		return {
			ok: false,
			specPath,
			generatedDir,
			generatedAssetIds: [],
			failures: [],
			message: getErrorMessage(error),
		};
	}
}

export async function runMediaCli(
	args: string[],
	io: DeckSpecCliIo = defaultCliIo,
	dependencies: GenerateMediaDependencies = {},
): Promise<number> {
	const projectDir = resolveProjectDir(args[0]);
	const result = await generateProjectMedia(projectDir, dependencies);

	if (result.ok) {
		io.stdout(`Generated media: ${result.generatedDir}`);
		io.stdout(`Updated canonical spec: ${result.specPath}`);
		if (result.generatedAssetIds.length > 0) {
			io.stdout(`Generated asset ids: ${result.generatedAssetIds.join(", ")}`);
		}
		return 0;
	}

	io.stderr(`Media generation failed for project: ${projectDir}`);
	io.stderr(`Generated media dir: ${result.generatedDir}`);
	io.stderr(`Canonical spec: ${result.specPath}`);

	if (result.message) {
		io.stderr(result.message);
	}
	if (result.validationErrors) {
		for (const error of result.validationErrors) {
			io.stderr(`- ${error.path}: ${error.message}`);
		}
	}
	for (const failure of result.failures) {
		io.stderr(`- ${failure.assetId}: ${failure.message}`);
	}

	return 1;
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runMediaCli(process.argv.slice(2));
	process.exit(exitCode);
}
