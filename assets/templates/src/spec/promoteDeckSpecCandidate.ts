import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { resolveGeminiApiKey } from "../deck-spec-module/media/providerEnv.js";
import type { PlanDeckSpecFromPromptDebugResult } from "../deck-spec-module/public-api.js";
import {
	DeckSpecPlanningError,
	planDeckSpecFromPrompt,
} from "../deck-spec-module/public-api.js";
import {
	type LegacySpecPromotionDependencies,
	runLegacySpecPromotionCli,
} from "./compat/legacyPromoteDeckSpecCandidate.js";
import {
	resolveDeckSpecPath,
	resolveProjectDir,
	resolveSpecCandidatePath,
	resolveSpecDiagnosticsPath,
	resolveSpecReviewMarkdownPath,
	resolveSpecReviewPath,
} from "./readDeckSpec.js";
import { renderSpecReviewMarkdown } from "./renderSpecReview.js";
import type { CliIo } from "./validateDeckSpec.js";
import { writeJsonFileAtomic, writeTextFileAtomic } from "./writeFileAtomic.js";

type ParsedSpecCliArgs = {
	projectDir: string;
	prompt?: string;
	debug: boolean;
};

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

function parseSpecCliArgs(
	args: string[],
): ParsedSpecCliArgs | { error: string } {
	let projectDir: string | undefined;
	let prompt: string | undefined;
	let debug = false;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--prompt") {
			prompt = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--prompt=")) {
			prompt = arg.slice("--prompt=".length);
			continue;
		}
		if (arg === "--debug") {
			debug = true;
			continue;
		}
		if (arg.startsWith("-")) {
			return {
				error: `Unsupported argument: ${arg}`,
			};
		}
		if (typeof projectDir !== "undefined") {
			return {
				error: "Only one optional project directory argument is supported.",
			};
		}
		projectDir = arg;
	}

	return {
		projectDir: resolveProjectDir(projectDir),
		prompt,
		debug,
	};
}

function getCliErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: `Unknown error: ${String(error)}`;
}

async function resolvePromptPlanningApiKey(
	projectDir: string,
): Promise<string> {
	try {
		return (await resolveGeminiApiKey(projectDir)).apiKey;
	} catch (error) {
		throw new DeckSpecPlanningError({
			code: "planning_failed",
			message: getCliErrorMessage(error),
		});
	}
}

export async function runSpecCli(
	args: string[],
	io: CliIo = defaultCliIo,
	legacyDependencies: LegacySpecPromotionDependencies = {},
): Promise<number> {
	const parsedArgs = parseSpecCliArgs(args);
	if ("error" in parsedArgs) {
		io.stderr(parsedArgs.error);
		io.stderr('Usage: pnpm spec -- --prompt "<prompt>"');
		return 1;
	}

	const projectDir = parsedArgs.projectDir;
	if (typeof parsedArgs.prompt !== "string") {
		return runLegacySpecPromotionCli(projectDir, io, legacyDependencies);
	}

	const candidatePath = resolveSpecCandidatePath(projectDir);
	const specPath = resolveDeckSpecPath(projectDir);
	const diagnosticsPath = resolveSpecDiagnosticsPath(projectDir);
	const reviewPath = resolveSpecReviewPath(projectDir);
	const reviewMarkdownPath = resolveSpecReviewMarkdownPath(projectDir);
	let debugResult: PlanDeckSpecFromPromptDebugResult | undefined;

	try {
		const apiKey = await resolvePromptPlanningApiKey(projectDir);
		const deckSpec = await planDeckSpecFromPrompt(parsedArgs.prompt, {
			apiKey,
			projectDir,
			projectSlug: path.basename(projectDir),
			onDebugResult: parsedArgs.debug
				? async (result) => {
						debugResult = result;
					}
				: undefined,
		});

		await writeJsonFileAtomic(specPath, deckSpec);

		if (parsedArgs.debug && typeof debugResult !== "undefined") {
			await writeJsonFileAtomic(candidatePath, debugResult.candidateDeckSpec);
			await writeJsonFileAtomic(reviewPath, debugResult.review);
			await writeTextFileAtomic(
				reviewMarkdownPath,
				`${renderSpecReviewMarkdown(debugResult.review)}\n`,
			);
			await writeJsonFileAtomic(diagnosticsPath, debugResult.diagnostics);
		}

		io.stdout(`Canonical deck spec written: ${specPath}`);
		if (parsedArgs.debug) {
			io.stdout(`Planning candidate snapshot: ${candidatePath}`);
			io.stdout(`Review report: ${reviewMarkdownPath}`);
			io.stdout(`Planning diagnostics: ${diagnosticsPath}`);
		}
		return 0;
	} catch (error) {
		if (parsedArgs.debug && error instanceof DeckSpecPlanningError) {
			await writeJsonFileAtomic(diagnosticsPath, error.diagnostics);
			io.stderr(`Planning diagnostics: ${diagnosticsPath}`);
		}

		io.stderr("Prompt-driven deck-spec planning failed.");
		io.stderr(`Canonical target unchanged: ${specPath}`);
		io.stderr(
			`Failure kind: ${error instanceof DeckSpecPlanningError ? error.code : "unexpected_error"}`,
		);
		io.stderr(`Retryable by skill: no`);
		io.stderr(getCliErrorMessage(error));
		return 1;
	}
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runSpecCli(process.argv.slice(2));
	process.exit(exitCode);
}
