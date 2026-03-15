import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { resolveGeminiApiKey } from "../deck-spec-module/media/providerEnv.js";
import {
	type DeckSpecPlanningErrorCode,
	isDeckSpecPlanningError,
	runDeckSpecModule,
	runDeckSpecValidateModule,
} from "../public-api.js";
import { findDeckRootForProject, resolveProjectDir } from "../spec/readDeckSpec.js";

type CliIo = {
	stdout: (message: string) => void;
	stderr: (message: string) => void;
};

type ParsedArgs = {
	projectDir: string;
	prompt?: string;
	label?: string;
};

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

function parseLiveSmokeArgs(
	args: string[],
): ParsedArgs | { error: string } {
	let projectDir: string | undefined;
	let prompt: string | undefined;
	let label: string | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--") {
			continue;
		}
		if (arg === "--prompt") {
			prompt = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--prompt=")) {
			prompt = arg.slice("--prompt=".length);
			continue;
		}
		if (arg === "--label") {
			label = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--label=")) {
			label = arg.slice("--label=".length);
			continue;
		}
		if (arg.startsWith("-")) {
			return {
				error: `Unsupported argument: ${arg}`,
			};
		}
		if (typeof projectDir !== "undefined") {
			return {
				error: "Only one project directory argument is supported.",
			};
		}
		projectDir = arg;
	}

	return {
		projectDir: resolveProjectDir(projectDir),
		prompt,
		label,
	};
}

function createRunLabel(label?: string): string {
	const isoStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
	if (typeof label !== "string" || label.trim() === "") {
		return isoStamp;
	}

	const normalizedLabel = label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return normalizedLabel === "" ? isoStamp : `${isoStamp}-${normalizedLabel}`;
}

function getFailureKind(error: unknown): DeckSpecPlanningErrorCode | "unexpected_error" {
	return isDeckSpecPlanningError(error) ? error.code : "unexpected_error";
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
}

export async function runLiveSmokeCli(
	args: string[],
	io: CliIo = defaultCliIo,
): Promise<number> {
	const parsedArgs = parseLiveSmokeArgs(args);
	if ("error" in parsedArgs) {
		io.stderr(parsedArgs.error);
		io.stderr('Usage: pnpm spec:live -- <project-dir> --prompt "<prompt>" [--label "<name>"]');
		return 1;
	}

	if (typeof parsedArgs.prompt !== "string") {
		io.stderr("Missing required --prompt value.");
		io.stderr('Usage: pnpm spec:live -- <project-dir> --prompt "<prompt>" [--label "<name>"]');
		return 1;
	}

	const projectDir = parsedArgs.projectDir;
	const deckRoot = findDeckRootForProject(projectDir);
	if (typeof deckRoot !== "string") {
		io.stderr(`Could not locate the shared deck root above project: ${projectDir}`);
		return 1;
	}

	const projectSlug = path.basename(projectDir);
	const runLabel = createRunLabel(parsedArgs.label);
	const runRootDir = path.join(
		deckRoot,
		"tmp",
		"deck-spec-module-live",
		projectSlug,
		runLabel,
	);
	const canonicalSpecPath = path.join(runRootDir, "spec", "deck-spec.json");
	const artifactRootDir = path.join(runRootDir, "artifacts");
	const reportPath = path.join(runRootDir, "validate.report.md");

	try {
		const apiKey = await resolveGeminiApiKey(projectDir);
		const result = await runDeckSpecModule({
			prompt: parsedArgs.prompt,
			apiKey: apiKey.apiKey,
			projectSlug,
			paths: {
				canonicalSpecPath,
				artifactRootDir,
			},
		});

		await runDeckSpecValidateModule({
			canonicalSpecPath: result.canonicalSpecPath,
			reportPath,
		});

		io.stdout(`Live smoke passed for project: ${projectSlug}`);
		io.stdout(`Canonical spec: ${result.canonicalSpecPath}`);
		io.stdout(`Artifact bundle: ${result.artifactRootDir}`);
		io.stdout(`Validation report: ${reportPath}`);
		io.stdout(`Used fallback: ${result.usedFallback ? "yes" : "no"}`);
		return 0;
	} catch (error) {
		io.stderr(`Live smoke failed for project: ${projectSlug}`);
		io.stderr(`Failure kind: ${getFailureKind(error)}`);
		io.stderr(`Run root: ${runRootDir}`);
		io.stderr(getErrorMessage(error));
		return 1;
	}
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runLiveSmokeCli(process.argv.slice(2));
	process.exit(exitCode);
}
