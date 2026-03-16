import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
	GEMINI_API_KEY_ENV_NAME,
	parseDotEnv,
	resolveGeminiApiKey,
} from "../src/deck-spec-module/media/providerEnv.js";
import {
	normalizeGeneratedImage,
	resolvePaddingColor,
	resolveResizeStrategy,
	resolveTargetDimensions,
} from "../src/deck-spec-module/media/imagePolicy.js";
import { createProjectTempDir } from "./testTempDir.js";

const tempDirs: string[] = [];
const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

async function createSourcePngBuffer(): Promise<Buffer> {
	return sharp({
		create: {
			width: 96,
			height: 64,
			channels: 4,
			background: {
				r: 24,
				g: 88,
				b: 144,
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
});
