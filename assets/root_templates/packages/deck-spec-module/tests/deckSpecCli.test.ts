import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runLiveSmokeCli } from "../src/cli/runLiveSmokeCli.js";
import { runSpecCli } from "../src/cli/runSpecCli.js";

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
	process.env.GEMINI_API_KEY = originalGeminiApiKey;
});

describe("deck-spec-module CLI guardrails", () => {
	it("defines the stable operator-facing package scripts", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as {
			exports?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};

		expect(packageJson.scripts).toMatchObject({
			spec: "node --import tsx src/cli/runSpecCli.ts",
			"spec:live": "node --import tsx src/cli/runLiveSmokeCli.ts",
			"spec:validate": "node --import tsx src/cli/runValidateCli.ts",
		});
		expect(packageJson.exports).toEqual({
			".": {
				types: "./src/public-root.ts",
				import: "./src/public-root.ts",
				default: "./src/public-root.ts",
			},
			"./spec": {
				types: "./src/public-spec.ts",
				import: "./src/public-spec.ts",
				default: "./src/public-spec.ts",
			},
			"./review": {
				types: "./src/public-review.ts",
				import: "./src/public-review.ts",
				default: "./src/public-review.ts",
			},
		});
	});

	it("requires explicit output paths for the shared spec CLI", async () => {
		const stdout: string[] = [];
		const stderr: string[] = [];

		const exitCode = await runSpecCli(
			[
				"/virtual/project",
				"--prompt",
				"Create a six-slide deck about canonical spec planning.",
			],
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
		);

		expect(exitCode).toBe(1);
		expect(stdout).toEqual([]);
		expect(stderr[0]).toBe("Missing required --canonical-spec-path value.");
		expect(stderr[1]).toContain("--artifact-root-dir");
	});

	it("requires an explicit media output path unless media is disabled", async () => {
		const stdout: string[] = [];
		const stderr: string[] = [];

		const exitCode = await runSpecCli(
			[
				"/virtual/project",
				"--prompt",
				"Create a six-slide deck about canonical spec planning.",
				"--canonical-spec-path",
				"/virtual/project/spec/deck-spec.json",
				"--artifact-root-dir",
				"/virtual/project/tmp/deck-spec-module",
			],
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
		);

		expect(exitCode).toBe(1);
		expect(stdout).toEqual([]);
		expect(stderr[0]).toBe("Missing required --media-output-dir value.");
		expect(stderr[1]).toContain("--no-media");
	});

	it("requires an explicit tmp root for live smoke runs", async () => {
		const stdout: string[] = [];
		const stderr: string[] = [];

		const exitCode = await runLiveSmokeCli(
			[
				"/virtual/project",
				"--prompt",
				"Create a six-slide deck about canonical spec planning.",
			],
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
		);

		expect(exitCode).toBe(1);
		expect(stdout).toEqual([]);
		expect(stderr[0]).toBe("Missing required --tmp-root-dir value.");
		expect(stderr[1]).toContain("--tmp-root-dir");
	});

	it("allows no-media runs without an explicit media output path", async () => {
		const stdout: string[] = [];
		const stderr: string[] = [];
		delete process.env.GEMINI_API_KEY;

		try {
			const exitCode = await runSpecCli(
				[
					"/virtual/project",
					"--prompt",
					"Create a six-slide deck about canonical spec planning.",
					"--canonical-spec-path",
					"/virtual/project/spec/deck-spec.json",
					"--artifact-root-dir",
					"/virtual/project/tmp/deck-spec-module",
					"--no-media",
				],
				{
					stdout: (message) => stdout.push(message),
					stderr: (message) => stderr.push(message),
				},
			);

			expect(exitCode).toBe(1);
			expect(stdout).toEqual([]);
			expect(stderr[0]).toBe("Prompt-driven deck-spec run failed.");
			expect(stderr[1]).toBe(
				"Canonical target unchanged: /virtual/project/spec/deck-spec.json",
			);
		} finally {
			process.env.GEMINI_API_KEY = originalGeminiApiKey;
		}
	});

	it("allows tests to inject a black-box module runner without touching internal planner or media modules", async () => {
		const stdout: string[] = [];
		const stderr: string[] = [];
		process.env.GEMINI_API_KEY = "test-key";
		const fakeRunDeckSpecModule = vi.fn(async () => ({
			canonicalSpecPath: "/virtual/project/spec/deck-spec.json",
			artifactRootDir: "/virtual/project/tmp/deck-spec-module",
			usedFallback: false,
		}));

		const exitCode = await runSpecCli(
			[
				"/virtual/project",
				"--prompt",
				"Create a six-slide deck about canonical spec planning and artifact delivery.",
				"--canonical-spec-path",
				"/virtual/project/spec/deck-spec.json",
				"--artifact-root-dir",
				"/virtual/project/tmp/deck-spec-module",
				"--media-output-dir",
				"/virtual/project/media/generated-images",
			],
			{
				stdout: (message) => stdout.push(message),
				stderr: (message) => stderr.push(message),
			},
			{
				runDeckSpecModule: fakeRunDeckSpecModule,
			},
		);

		expect(exitCode).toBe(0);
		expect(stderr).toEqual([]);
		expect(fakeRunDeckSpecModule).toHaveBeenCalledWith({
			prompt:
				"Create a six-slide deck about canonical spec planning and artifact delivery.",
			apiKey: "test-key",
			projectSlug: "project",
			paths: {
				canonicalSpecPath: "/virtual/project/spec/deck-spec.json",
				artifactRootDir: "/virtual/project/tmp/deck-spec-module",
				mediaOutputDir: "/virtual/project/media/generated-images",
			},
			media: {
				enabled: true,
			},
		});
		expect(stdout).toEqual([
			"Canonical deck spec written: /virtual/project/spec/deck-spec.json",
			"Artifact bundle written: /virtual/project/tmp/deck-spec-module",
			"Generated media dir: /virtual/project/media/generated-images",
		]);
	});
});
