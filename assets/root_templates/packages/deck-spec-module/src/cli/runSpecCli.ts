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
	resolveProjectDir,
} from "../spec/readDeckSpec.js";

type CliIo = {
	stdout: (message: string) => void;
	stderr: (message: string) => void;
};

type ParsedSpecCliArgs = {
	projectDir: string;
	prompt?: string;
	canonicalSpecPath?: string;
	artifactRootDir?: string;
	mediaOutputDir?: string;
	mediaEnabled: boolean;
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
	let canonicalSpecPath: string | undefined;
	let artifactRootDir: string | undefined;
	let mediaOutputDir: string | undefined;
	let mediaEnabled = true;

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
		if (arg === "--canonical-spec-path") {
			canonicalSpecPath = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--canonical-spec-path=")) {
			canonicalSpecPath = arg.slice("--canonical-spec-path=".length);
			continue;
		}
		if (arg === "--artifact-root-dir") {
			artifactRootDir = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--artifact-root-dir=")) {
			artifactRootDir = arg.slice("--artifact-root-dir=".length);
			continue;
		}
		if (arg === "--media-output-dir") {
			mediaOutputDir = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--media-output-dir=")) {
			mediaOutputDir = arg.slice("--media-output-dir=".length);
			continue;
		}
		if (arg === "--no-media") {
			mediaEnabled = false;
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
		canonicalSpecPath:
			typeof canonicalSpecPath === "string"
				? path.resolve(canonicalSpecPath)
				: undefined,
		artifactRootDir:
			typeof artifactRootDir === "string"
				? path.resolve(artifactRootDir)
				: undefined,
		mediaOutputDir:
			typeof mediaOutputDir === "string"
				? path.resolve(mediaOutputDir)
				: undefined,
		mediaEnabled,
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
		io.stderr(
			'Usage: pnpm spec -- --prompt "<prompt>" --canonical-spec-path "<path>" --artifact-root-dir "<path>" [--media-output-dir "<path>"] [--no-media]',
		);
		return 1;
	}

	const projectDir = parsedArgs.projectDir;
	if (typeof parsedArgs.prompt !== "string") {
		io.stderr("Missing required --prompt value.");
		io.stderr(
			'Usage: pnpm spec -- --prompt "<prompt>" --canonical-spec-path "<path>" --artifact-root-dir "<path>" [--media-output-dir "<path>"] [--no-media]',
		);
		return 1;
	}

	if (typeof parsedArgs.canonicalSpecPath !== "string") {
		io.stderr("Missing required --canonical-spec-path value.");
		io.stderr(
			'Usage: pnpm spec -- --prompt "<prompt>" --canonical-spec-path "<path>" --artifact-root-dir "<path>" [--media-output-dir "<path>"] [--no-media]',
		);
		return 1;
	}

	if (typeof parsedArgs.artifactRootDir !== "string") {
		io.stderr("Missing required --artifact-root-dir value.");
		io.stderr(
			'Usage: pnpm spec -- --prompt "<prompt>" --canonical-spec-path "<path>" --artifact-root-dir "<path>" [--media-output-dir "<path>"] [--no-media]',
		);
		return 1;
	}

	if (parsedArgs.mediaEnabled && typeof parsedArgs.mediaOutputDir !== "string") {
		io.stderr("Missing required --media-output-dir value.");
		io.stderr(
			'Usage: pnpm spec -- --prompt "<prompt>" --canonical-spec-path "<path>" --artifact-root-dir "<path>" [--media-output-dir "<path>"] [--no-media]',
		);
		return 1;
	}

	const specPath = parsedArgs.canonicalSpecPath;
	const artifactRootDir = parsedArgs.artifactRootDir;
	const mediaOutputDir = parsedArgs.mediaOutputDir;

	try {
		const apiKey = await resolvePromptPlanningApiKey(projectDir);
		const result = await runDeckSpecModule({
			prompt: parsedArgs.prompt,
			apiKey,
			projectSlug: path.basename(projectDir),
			paths: {
				canonicalSpecPath: specPath,
				artifactRootDir,
				mediaOutputDir,
			},
			media: {
				enabled: parsedArgs.mediaEnabled,
			},
		});

		io.stdout(`Canonical deck spec written: ${result.canonicalSpecPath}`);
		io.stdout(`Artifact bundle written: ${result.artifactRootDir}`);
		if (parsedArgs.mediaEnabled && typeof mediaOutputDir === "string") {
			io.stdout(`Generated media dir: ${mediaOutputDir}`);
		} else {
			io.stdout("Media phase skipped.");
		}
		return 0;
	} catch (error) {
		const failureKind = getFailureKind(error);
		io.stderr("Prompt-driven deck-spec run failed.");
		if (failureKind === "media_generation_failed") {
			io.stderr(`Canonical deck spec published: ${specPath}`);
			if (typeof mediaOutputDir === "string") {
				io.stderr(`Media output dir: ${mediaOutputDir}`);
			}
		} else {
			io.stderr(`Canonical target unchanged: ${specPath}`);
		}
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
