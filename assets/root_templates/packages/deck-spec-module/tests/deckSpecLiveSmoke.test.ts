import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generateImageWithGemini } from "../src/deck-spec-module/media/geminiImageProvider.js";
import { generateDeckSpecCandidateWithGemini } from "../src/deck-spec-module/planning/geminiPlannerModel.js";
import { runLiveSmokeCli } from "../src/cli/runLiveSmokeCli.js";
import {
	createPlanCandidateFromScenarioPlan,
	loadDeckSpecBaselinePlan,
} from "./deckSpecScenarioFixtures.js";
import { createProjectTempDir } from "./testTempDir.js";

vi.mock("../src/deck-spec-module/planning/geminiPlannerModel.js", () => ({
	generateDeckSpecCandidateWithGemini: vi.fn(),
}));
vi.mock("../src/deck-spec-module/media/geminiImageProvider.js", () => ({
	generateImageWithGemini: vi.fn(),
}));

const mockedGenerateDeckSpecCandidateWithGemini = vi.mocked(
	generateDeckSpecCandidateWithGemini,
);
const mockedGenerateImageWithGemini = vi.mocked(generateImageWithGemini);
const tempDirs: string[] = [];
const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

async function createMockImageBuffer(): Promise<Buffer> {
	return sharp({
		create: {
			width: 96,
			height: 64,
			channels: 4,
			background: {
				r: 32,
				g: 96,
				b: 152,
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
	tmpRootDir: string;
}> {
	const tempRoot = await createProjectTempDir(packageRoot, "deck-spec-live-smoke");
	const deckRoot = path.join(tempRoot, "deck-root");
	const projectDir = path.join(deckRoot, "projects", "test-project");
	const tmpRootDir = path.join(deckRoot, "tmp", "deck-spec-module-live");
	tempDirs.push(tempRoot);

	await mkdir(path.join(deckRoot, ".ai-native-slides"), { recursive: true });
	await mkdir(projectDir, { recursive: true });
	await writeFile(path.join(deckRoot, ".env"), "GEMINI_API_KEY=test-key\n", "utf8");
	await writeFile(path.join(deckRoot, ".ai-native-slides", "root.json"), "{}\n", "utf8");

	return {
		deckRoot,
		projectDir,
		tmpRootDir,
	};
}

afterEach(async () => {
	vi.resetAllMocks();
	for (const tempDir of tempDirs) {
		await rm(tempDir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

describe("deck-spec live smoke", () => {
	it("writes canonical spec, artifacts, validation report, and media only into the temp run root", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const tempProject = await createTempProject();
		const stdout: string[] = [];
		const stderr: string[] = [];

		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);
		mockedGenerateImageWithGemini.mockImplementation(async () => ({
			imageBytes: await createMockImageBuffer(),
			mimeType: "image/png",
			model: "mock-gemini-image",
		}));

		const exitCode = await runLiveSmokeCli(
			[
				tempProject.projectDir,
				"--tmp-root-dir",
				tempProject.tmpRootDir,
				"--prompt",
				"Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery.",
				"--label",
				"temp-isolation",
			],
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
		);

		expect(exitCode).toBe(0);
		expect(stderr).toEqual([]);
		expect(stdout[0]).toContain("Live smoke passed for project: test-project");

		const runDirs = await readdir(tempProject.tmpRootDir);
		expect(runDirs).toHaveLength(1);
		const runRootDir = path.join(tempProject.tmpRootDir, runDirs[0] ?? "");

		expect(existsSync(path.join(runRootDir, "spec", "deck-spec.json"))).toBe(true);
		expect(existsSync(path.join(runRootDir, "artifacts", "result.json"))).toBe(
			true,
		);
		expect(existsSync(path.join(runRootDir, "artifacts", "report.md"))).toBe(
			true,
		);
		expect(existsSync(path.join(runRootDir, "validate.report.md"))).toBe(true);
		expect(
			existsSync(path.join(runRootDir, "media", "generated-images")),
		).toBe(true);

		expect(
			existsSync(path.join(tempProject.projectDir, "spec", "deck-spec.json")),
		).toBe(false);
		expect(
			existsSync(
				path.join(
					tempProject.projectDir,
					"media",
					"generated-images",
				),
			),
		).toBe(false);
	});
});
