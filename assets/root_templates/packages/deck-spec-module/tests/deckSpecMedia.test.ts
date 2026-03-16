import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	GEMINI_API_KEY_ENV_NAME,
	materializeDeckSpecMedia,
	normalizeGeneratedImage,
	parseDotEnv,
	resolveGeminiApiKey,
	resolvePaddingColor,
	resolveResizeStrategy,
	resolveTargetDimensions,
} from "../src/public-testing.js";
import type { DeckSpec } from "../src/spec/contract.js";
import { normalizeSystemManagedFields } from "../src/spec/normalizeSystemManagedFields.js";
import {
	createPlanCandidateFromScenarioPlan,
	loadDeckSpecBaselinePlan,
} from "./deckSpecScenarioFixtures.js";
import { createProjectTempDir } from "./testTempDir.js";

const tempDirs: string[] = [];
const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

async function createSourcePngBuffer(background?: {
	r: number;
	g: number;
	b: number;
}): Promise<Buffer> {
	return sharp({
		create: {
			width: 96,
			height: 64,
			channels: 4,
			background: {
				r: background?.r ?? 24,
				g: background?.g ?? 88,
				b: background?.b ?? 144,
				alpha: 1,
			},
		},
	})
		.png()
		.toBuffer();
}

async function createTempProject(): Promise<{
	deckRoot: string;
	projectDir: string;
	envPath: string;
}> {
	const tempRoot = await createProjectTempDir(packageRoot, "deck-spec-media");
	const deckRoot = path.join(tempRoot, "deck-root");
	const projectDir = path.join(deckRoot, "projects", "demo-deck");
	const envPath = path.join(deckRoot, ".env");
	tempDirs.push(tempRoot);

	await mkdir(path.join(deckRoot, ".ai-native-slides"), { recursive: true });
	await mkdir(projectDir, { recursive: true });
	await writeFile(
		path.join(deckRoot, ".ai-native-slides", "root.json"),
		"{}\n",
	);

	return {
		deckRoot,
		projectDir,
		envPath,
	};
}

function createReviewedDeckSpec(
	plan: DeckSpec,
	prompt: string,
	projectSlug = "demo-deck",
): DeckSpec {
	return normalizeSystemManagedFields(createPlanCandidateFromScenarioPlan(plan), {
		projectSlug,
		sourcePrompt: prompt,
		specStatus: "reviewed",
	});
}

afterEach(async () => {
	for (const tempDir of tempDirs) {
		await rm(tempDir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

describe("deck-spec media helpers", () => {
	it("parses deck-root .env documents", () => {
		const result = parseDotEnv(`
			# comment
			${GEMINI_API_KEY_ENV_NAME}="file-key"
			OTHER_VALUE=42
		`);

		expect(result).toEqual({
			GEMINI_API_KEY: "file-key",
			OTHER_VALUE: "42",
		});
	});

	it("prefers the current shell environment over deck-root .env", async () => {
		const tempProject = await createTempProject();
		await writeFile(
			tempProject.envPath,
			`${GEMINI_API_KEY_ENV_NAME}=from-file\n`,
			"utf8",
		);

		const result = await resolveGeminiApiKey(tempProject.projectDir, {
			processEnv: {
				[GEMINI_API_KEY_ENV_NAME]: "from-process",
			},
		});

		expect(result.apiKey).toBe("from-process");
		expect(result.source).toBe("process_env");
	});

	it("falls back to deck-root .env when the current shell is missing the key", async () => {
		const tempProject = await createTempProject();
		await writeFile(
			tempProject.envPath,
			`${GEMINI_API_KEY_ENV_NAME}=from-file\n`,
			"utf8",
		);

		const result = await resolveGeminiApiKey(tempProject.projectDir, {
			processEnv: {},
		});

		expect(result.apiKey).toBe("from-file");
		expect(result.source).toBe("deck_root_env");
		expect(result.deckRoot).toBe(tempProject.deckRoot);
	});

	it("fails clearly when neither the shell nor deck-root .env provide the key", async () => {
		const tempProject = await createTempProject();

		await expect(
			resolveGeminiApiKey(tempProject.projectDir, {
				processEnv: {},
			}),
		).rejects.toThrow(`Missing ${GEMINI_API_KEY_ENV_NAME}`);
	});

	it("maps size tiers to deterministic output dimensions", () => {
		expect(resolveTargetDimensions("small", "16:9")).toEqual({
			width: 512,
			height: 288,
		});
		expect(resolveTargetDimensions("medium", "16:9")).toEqual({
			width: 1024,
			height: 576,
		});
		expect(resolveTargetDimensions("large", "16:9")).toEqual({
			width: 1920,
			height: 1080,
		});
		expect(resolveTargetDimensions("large", "4:3")).toEqual({
			width: 1600,
			height: 1200,
		});
	});

	it("uses crop for hero/background and contain for other asset usages", () => {
		expect(resolveResizeStrategy("hero_visual")).toBe("crop");
		expect(resolveResizeStrategy("background")).toBe("crop");
		expect(resolveResizeStrategy("supporting_visual")).toBe("contain");
		expect(resolveResizeStrategy("diagram")).toBe("contain");
		expect(resolveResizeStrategy("icon")).toBe("contain");
	});

	it("uses transparent padding for png and a light solid background for jpg", () => {
		expect(resolvePaddingColor("png")).toEqual({
			r: 0,
			g: 0,
			b: 0,
			alpha: 0,
		});
		expect(resolvePaddingColor("jpg")).toEqual({
			r: 245,
			g: 246,
			b: 248,
			alpha: 1,
		});
	});

	it("normalizes contain outputs to the expected dimensions", async () => {
		const sourceBuffer = await createSourcePngBuffer();
		const normalizedBuffer = await normalizeGeneratedImage({
			sourceBuffer,
			outputFormat: "png",
			sizeTier: "medium",
			aspectRatio: "16:9",
			intendedUsage: "supporting_visual",
		});

		const metadata = await sharp(normalizedBuffer).metadata();
		expect(metadata.format).toBe("png");
		expect(metadata.width).toBe(1024);
		expect(metadata.height).toBe(576);
	});

	it("normalizes crop outputs to the expected dimensions", async () => {
		const sourceBuffer = await createSourcePngBuffer();
		const normalizedBuffer = await normalizeGeneratedImage({
			sourceBuffer,
			outputFormat: "jpg",
			sizeTier: "small",
			aspectRatio: "16:9",
			intendedUsage: "hero_visual",
		});

		const metadata = await sharp(normalizedBuffer).metadata();
		expect(metadata.format).toBe("jpeg");
		expect(metadata.width).toBe(512);
		expect(metadata.height).toBe(288);
	});

	it("materializes required assets through the injected generator and promotes the spec to media_ready", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const tempProject = await createTempProject();
		const reviewedDeckSpec = createReviewedDeckSpec(
			baselinePlan,
			"Create a six-slide deck about canonical spec planning and generated visuals.",
		);
		const mediaOutputDir = path.join(
			tempProject.projectDir,
			"media",
			"generated-images",
		);
		const generateImage = vi.fn(async () => ({
			imageBytes: await createSourcePngBuffer(),
			mimeType: "image/png",
			model: "mock-gemini-image",
		}));

		const result = await materializeDeckSpecMedia({
			deckSpec: reviewedDeckSpec,
			mediaOutputDir,
			apiKey: "test-key",
			generateImage,
		});

		expect(result.ok).toBe(true);
		expect(result.deckSpec.status).toBe("media_ready");
		expect(result.failures).toEqual([]);
		expect(result.generatedAssetIds).toHaveLength(
			reviewedDeckSpec.asset_manifest.image_assets.length +
				reviewedDeckSpec.asset_manifest.shared_assets.length,
		);
		for (const asset of [
			...result.deckSpec.asset_manifest.image_assets,
			...result.deckSpec.asset_manifest.shared_assets,
		]) {
			expect(asset.status).toBe("generated");
			expect(existsSync(path.join(mediaOutputDir, asset.output_file_name))).toBe(
				true,
			);
		}
	});

	it("records per-asset failures and keeps the spec at reviewed when media generation is partial", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const tempProject = await createTempProject();
		const reviewedDeckSpec = createReviewedDeckSpec(
			baselinePlan,
			"Create a six-slide deck about canonical spec planning and generated visuals.",
		);
		const mediaOutputDir = path.join(
			tempProject.projectDir,
			"media",
			"generated-images",
		);
		let requestCount = 0;

		const result = await materializeDeckSpecMedia({
			deckSpec: reviewedDeckSpec,
			mediaOutputDir,
			apiKey: "test-key",
			generateImage: async () => {
				requestCount += 1;
				if (requestCount === 1) {
					return {
						imageBytes: await createSourcePngBuffer({
							r: 40,
							g: 96,
							b: 152,
						}),
						mimeType: "image/png",
						model: "mock-gemini-image",
					};
				}

				throw new Error("mock media failure");
			},
		});

		expect(result.ok).toBe(false);
		expect(result.deckSpec.status).toBe("reviewed");
		expect(result.generatedAssetIds).toHaveLength(1);
		expect(result.failures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "mock media failure",
				}),
			]),
		);
		expect(
			result.deckSpec.asset_manifest.image_assets.some(
				(asset) => asset.status === "generated",
			),
		).toBe(true);
		expect(
			result.manifest.some((entry) => entry.required && entry.exists),
		).toBe(true);
	});

	it("promotes reviewed specs with no required images directly to media_ready", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const noRequiredMediaPlan = structuredClone(baselinePlan);
		noRequiredMediaPlan.asset_manifest.image_assets =
			noRequiredMediaPlan.asset_manifest.image_assets.map((asset) => ({
				...asset,
				required: false,
			}));
		noRequiredMediaPlan.asset_manifest.shared_assets =
			noRequiredMediaPlan.asset_manifest.shared_assets.map((asset) => ({
				...asset,
				required: false,
			}));
		const tempProject = await createTempProject();
		const generateImage = vi.fn();

		const result = await materializeDeckSpecMedia({
			deckSpec: createReviewedDeckSpec(
				noRequiredMediaPlan,
				"Create a six-slide deck about canonical spec planning without required generated visuals.",
			),
			mediaOutputDir: path.join(
				tempProject.projectDir,
				"media",
				"generated-images",
			),
			apiKey: "test-key",
			generateImage,
		});

		expect(result.ok).toBe(true);
		expect(result.deckSpec.status).toBe("media_ready");
		expect(result.generatedAssetIds).toEqual([]);
		expect(generateImage).not.toHaveBeenCalled();
	});
});
