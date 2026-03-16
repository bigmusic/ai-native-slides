import { describe, expect, it } from "vitest";

import { runLiveSmokeCli } from "../src/cli/runLiveSmokeCli.js";
import { runSpecCli } from "../src/cli/runSpecCli.js";

describe("deck-spec-module CLI guardrails", () => {
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
		const originalGeminiApiKey = process.env.GEMINI_API_KEY;
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
});
