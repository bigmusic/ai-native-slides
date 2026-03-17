import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runLiveSmokeCli } from "../src/cli/runLiveSmokeCli.js";
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

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${content}\n`, "utf8");
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
	vi.useRealTimers();
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
		const fakeRunDeckSpecModule = vi.fn(
			async ({
				prompt,
				projectSlug,
				paths,
				media,
			}: {
				prompt: string;
				projectSlug: string;
				paths: {
					canonicalSpecPath: string;
					artifactRootDir: string;
					mediaOutputDir?: string;
				};
				media?: {
					enabled?: boolean;
				};
			}) => {
				const deckSpec = normalizeSystemManagedFields(
					createPlanCandidateFromScenarioPlan(baselinePlan),
					{
						projectSlug,
						sourcePrompt: prompt,
						specStatus: media?.enabled === false ? "reviewed" : "media_ready",
						imageAssetStatus: media?.enabled === false ? "planned" : "generated",
					},
				);
				await writeJsonFile(paths.canonicalSpecPath, deckSpec);
				await writeJsonFile(path.join(paths.artifactRootDir, "result.json"), {
					ok: true,
				});
				await writeTextFile(
					path.join(paths.artifactRootDir, "report.md"),
					"# Deck-Spec Module Run",
				);
				if (typeof paths.mediaOutputDir === "string" && media?.enabled !== false) {
					await mkdir(paths.mediaOutputDir, { recursive: true });
				}

				return {
					canonicalSpecPath: paths.canonicalSpecPath,
					artifactRootDir: paths.artifactRootDir,
					usedFallback: false,
				};
			},
		);
		const fakeRunDeckSpecValidateModule = vi.fn(
			async ({
				reportPath,
			}: {
				canonicalSpecPath: string;
				reportPath?: string;
			}) => {
				if (typeof reportPath === "string") {
					await writeTextFile(reportPath, "# Deck-Spec Validation");
				}

				return { ok: true as const };
			},
		);

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
			{
				runDeckSpecModule: fakeRunDeckSpecModule,
				runDeckSpecValidateModule: fakeRunDeckSpecValidateModule,
			},
		);

		expect(exitCode).toBe(0);
		expect(stderr).toEqual([]);
		expect(stdout[0]).toContain("Live smoke passed for project: test-project");
		expect(fakeRunDeckSpecModule).toHaveBeenCalledTimes(1);
		expect(fakeRunDeckSpecValidateModule).toHaveBeenCalledTimes(1);

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

	it("reports published temp outputs when validation fails after canonical publish", async () => {
		const tempProject = await createTempProject();
		const stdout: string[] = [];
		const stderr: string[] = [];
		const fakeRunDeckSpecModule = vi.fn(
			async ({
				paths,
			}: {
				paths: {
					canonicalSpecPath: string;
					artifactRootDir: string;
					mediaOutputDir?: string;
				};
			}) => {
				await writeJsonFile(paths.canonicalSpecPath, {
					ok: true,
				});
				await writeJsonFile(path.join(paths.artifactRootDir, "result.json"), {
					ok: true,
				});
				if (typeof paths.mediaOutputDir === "string") {
					await mkdir(paths.mediaOutputDir, { recursive: true });
				}

				return {
					canonicalSpecPath: paths.canonicalSpecPath,
					artifactRootDir: paths.artifactRootDir,
					usedFallback: false,
				};
			},
		);
		const fakeRunDeckSpecValidateModule = vi.fn(
			async ({
				reportPath,
			}: {
				canonicalSpecPath: string;
				reportPath?: string;
			}) => {
				if (typeof reportPath === "string") {
					await writeTextFile(reportPath, "# Deck-Spec Validation");
				}

				throw new Error("Mock validation failure after publish.");
			},
		);

		const exitCode = await runLiveSmokeCli(
			[
				tempProject.projectDir,
				"--tmp-root-dir",
				tempProject.tmpRootDir,
				"--prompt",
				"Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery.",
				"--label",
				"validate-after-publish",
			],
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
			{
				runDeckSpecModule: fakeRunDeckSpecModule,
				runDeckSpecValidateModule: fakeRunDeckSpecValidateModule,
			},
		);

		expect(exitCode).toBe(1);
		expect(stdout).toEqual([]);
		expect(fakeRunDeckSpecModule).toHaveBeenCalledTimes(1);
		expect(fakeRunDeckSpecValidateModule).toHaveBeenCalledTimes(1);

		const runDirs = await readdir(tempProject.tmpRootDir);
		expect(runDirs).toHaveLength(1);
		const runRootDir = path.join(tempProject.tmpRootDir, runDirs[0] ?? "");

		expect(stderr).toEqual([
			"Live smoke failed for project: test-project",
			"Failure kind: contract_validation_failed",
			`Run root: ${runRootDir}`,
			`Canonical spec: ${path.join(runRootDir, "spec", "deck-spec.json")}`,
			`Artifact bundle: ${path.join(runRootDir, "artifacts")}`,
			`Validation report: ${path.join(runRootDir, "validate.report.md")}`,
			`Media output dir: ${path.join(runRootDir, "media", "generated-images")}`,
			"Mock validation failure after publish.",
		]);
	});

	it("reserves a unique temp run root when repeated live-smoke labels collide", async () => {
		const tempProject = await createTempProject();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-16T17:00:00.000Z"));
		const stdout: string[] = [];
		const stderr: string[] = [];
		const fakeRunDeckSpecModule = vi.fn(
			async ({
				paths,
			}: {
				paths: {
					canonicalSpecPath: string;
					artifactRootDir: string;
					mediaOutputDir?: string;
				};
			}) => {
				await writeJsonFile(paths.canonicalSpecPath, {
					ok: true,
				});
				await writeJsonFile(path.join(paths.artifactRootDir, "result.json"), {
					ok: true,
				});
				if (typeof paths.mediaOutputDir === "string") {
					await mkdir(paths.mediaOutputDir, { recursive: true });
				}

				return {
					canonicalSpecPath: paths.canonicalSpecPath,
					artifactRootDir: paths.artifactRootDir,
					usedFallback: false,
				};
			},
		);
		const fakeRunDeckSpecValidateModule = vi.fn(
			async ({
				reportPath,
			}: {
				canonicalSpecPath: string;
				reportPath?: string;
			}) => {
				if (typeof reportPath === "string") {
					await writeTextFile(reportPath, "# Deck-Spec Validation");
				}

				return { ok: true as const };
			},
		);
		const args = [
			tempProject.projectDir,
			"--tmp-root-dir",
			tempProject.tmpRootDir,
			"--prompt",
			"Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery.",
			"--label",
			"collision",
		];

		const firstExitCode = await runLiveSmokeCli(
			args,
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
			{
				runDeckSpecModule: fakeRunDeckSpecModule,
				runDeckSpecValidateModule: fakeRunDeckSpecValidateModule,
			},
		);
		const secondExitCode = await runLiveSmokeCli(
			args,
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
			{
				runDeckSpecModule: fakeRunDeckSpecModule,
				runDeckSpecValidateModule: fakeRunDeckSpecValidateModule,
			},
		);

		expect(firstExitCode).toBe(0);
		expect(secondExitCode).toBe(0);
		expect(stderr).toEqual([]);
		expect(fakeRunDeckSpecModule).toHaveBeenCalledTimes(2);
		expect(fakeRunDeckSpecValidateModule).toHaveBeenCalledTimes(2);

		const runDirs = (await readdir(tempProject.tmpRootDir)).sort();
		expect(runDirs).toEqual([
			"20260316T170000000Z-collision",
			"20260316T170000000Z-collision-2",
		]);
		for (const runDir of runDirs) {
			const runRootDir = path.join(tempProject.tmpRootDir, runDir);
			expect(existsSync(path.join(runRootDir, "spec", "deck-spec.json"))).toBe(
				true,
			);
			expect(existsSync(path.join(runRootDir, "artifacts", "result.json"))).toBe(
				true,
			);
			expect(existsSync(path.join(runRootDir, "validate.report.md"))).toBe(true);
		}
	});
});
