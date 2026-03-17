import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
	buildPresentation,
	defaultOutputFile,
	writePresentation,
} from "../src/buildDeck.js";
import { createStarterDeckModel } from "../src/presentationModel.js";

const tempDirs: string[] = [];
const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

afterEach(async () => {
	for (const tempDir of tempDirs) {
		await rm(tempDir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

async function createStarterTempDir(prefix: string): Promise<string> {
	const tempBaseDir = path.join(projectRoot, "tmp", "vitest");
	await mkdir(tempBaseDir, { recursive: true });
	return mkdtemp(path.join(tempBaseDir, `${prefix}-`));
}

describe("createStarterDeckModel", () => {
	it("defines a stable starter narrative", () => {
		const model = createStarterDeckModel();

		expect(model.workflowSteps).toHaveLength(4);
		expect(model.metrics).toHaveLength(3);
		expect(model.roadmap).toHaveLength(3);
		expect(model.title).toBe("AI Native Presentation Studio");
	});
});

describe("buildPresentation", () => {
	it("returns a four-slide wide deck", () => {
		const result = buildPresentation();

		expect(result.slideCount).toBe(4);
		expect(result.pptx.layout).toBe("LAYOUT_WIDE");
		expect(result.pptx.title).toBe("AI Native Presentation Studio");
	});

	it("derives the default output file from the project directory name", () => {
		expect(path.basename(defaultOutputFile)).toBe(
			`${path.basename(projectRoot)}.pptx`,
		);
	});

	it("writes a non-empty pptx artifact", async () => {
		const tempDir = await createStarterTempDir("build-deck");
		const outputFile = path.join(tempDir, "starter-deck.pptx");
		tempDirs.push(tempDir);

		const result = await writePresentation(outputFile);
		const outputStat = await stat(outputFile);

		expect(result.slideCount).toBe(4);
		expect(result.outputFile).toBe(outputFile);
		expect(outputStat.size).toBeGreaterThan(0);
	});
});
