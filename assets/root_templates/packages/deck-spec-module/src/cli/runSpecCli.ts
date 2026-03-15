import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { resolveGeminiApiKey } from "../deck-spec-module/media/providerEnv.js";
import {
	type DeckSpecPlanningErrorCode,
	DeckSpecPlanningError,
	isDeckSpecPlanningError,
	runDeckSpecModule,
} from "../public-api.js";
import {
	resolveDeckSpecModuleArtifactRootDir,
	resolveDeckSpecPath,
	resolveProjectDir,
} from "../spec/readDeckSpec.js";

type CliIo = {
	stdout: (message: string) => void;
	stderr: (message: string) => void;
};

type ParsedSpecCliArgs = {
	projectDir: string;
	prompt?: string;
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
	};
}

function getCliErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: `Unknown error: ${String(error)}`;
}

function getFailureKind(error: unknown): DeckSpecPlanningErrorCode | "unexpected_error" {
	return isDeckSpecPlanningError(error) ? error.code : "unexpected_error";
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
): Promise<number> {
	const parsedArgs = parseSpecCliArgs(args);
	if ("error" in parsedArgs) {
		io.stderr(parsedArgs.error);
		io.stderr('Usage: pnpm spec -- --prompt "<prompt>"');
		return 1;
	}

	const projectDir = parsedArgs.projectDir;
	if (typeof parsedArgs.prompt !== "string") {
		io.stderr("Missing required --prompt value.");
		io.stderr('Usage: pnpm spec -- --prompt "<prompt>"');
		return 1;
	}

	const specPath = resolveDeckSpecPath(projectDir);
	const artifactRootDir = resolveDeckSpecModuleArtifactRootDir(projectDir);

	try {
		const apiKey = await resolvePromptPlanningApiKey(projectDir);
		const result = await runDeckSpecModule({
			prompt: parsedArgs.prompt,
			apiKey,
			projectSlug: path.basename(projectDir),
			paths: {
				canonicalSpecPath: specPath,
				artifactRootDir,
			},
		});

		io.stdout(`Canonical deck spec written: ${result.canonicalSpecPath}`);
		io.stdout(`Artifact bundle written: ${result.artifactRootDir}`);
		return 0;
	} catch (error) {
		io.stderr("Prompt-driven deck-spec planning failed.");
		io.stderr(`Canonical target unchanged: ${specPath}`);
		io.stderr(`Failure kind: ${getFailureKind(error)}`);
		io.stderr(`Artifact bundle: ${artifactRootDir}`);
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
