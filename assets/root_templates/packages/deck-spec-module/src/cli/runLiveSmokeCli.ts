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
import { resolveProjectDir } from "../spec/readDeckSpec.js";

type CliIo = {
	stdout: (message: string) => void;
	stderr: (message: string) => void;
};

type RunLiveSmokeCliDependencies = {
	runDeckSpecModule?: typeof runDeckSpecModule;
	runDeckSpecValidateModule?: typeof runDeckSpecValidateModule;
};

type ParsedArgs = {
	projectDir: string;
	prompt?: string;
	tmpRootDir?: string;
	label?: string;
	mediaEnabled: boolean;
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
	let tmpRootDir: string | undefined;
	let label: string | undefined;
	let mediaEnabled = true;

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
		if (arg === "--tmp-root-dir") {
			tmpRootDir = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--tmp-root-dir=")) {
			tmpRootDir = arg.slice("--tmp-root-dir=".length);
			continue;
		}
		if (arg === "--no-media") {
			mediaEnabled = false;
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
		tmpRootDir:
			typeof tmpRootDir === "string" ? path.resolve(tmpRootDir) : undefined,
		label,
		mediaEnabled,
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
	deps: RunLiveSmokeCliDependencies = {},
): Promise<number> {
	const parsedArgs = parseLiveSmokeArgs(args);
	if ("error" in parsedArgs) {
		io.stderr(parsedArgs.error);
		io.stderr(
			'Usage: pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"] [--no-media]',
		);
		return 1;
	}

	if (typeof parsedArgs.prompt !== "string") {
		io.stderr("Missing required --prompt value.");
		io.stderr(
			'Usage: pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"] [--no-media]',
		);
		return 1;
	}

	if (typeof parsedArgs.tmpRootDir !== "string") {
		io.stderr("Missing required --tmp-root-dir value.");
		io.stderr(
			'Usage: pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"] [--no-media]',
		);
		return 1;
	}

	const projectDir = parsedArgs.projectDir;
	const projectSlug = path.basename(projectDir);
	const runLabel = createRunLabel(parsedArgs.label);
	const runRootDir = path.join(parsedArgs.tmpRootDir, runLabel);
	const canonicalSpecPath = path.join(runRootDir, "spec", "deck-spec.json");
	const artifactRootDir = path.join(runRootDir, "artifacts");
	const mediaOutputDir = path.join(runRootDir, "media", "generated-images");
	const reportPath = path.join(runRootDir, "validate.report.md");
	const executeRunDeckSpecModule = deps.runDeckSpecModule ?? runDeckSpecModule;
	const executeRunDeckSpecValidateModule =
		deps.runDeckSpecValidateModule ?? runDeckSpecValidateModule;

	try {
		const apiKey = await resolveGeminiApiKey(projectDir);
		const result = await executeRunDeckSpecModule({
			prompt: parsedArgs.prompt,
			apiKey: apiKey.apiKey,
			projectSlug,
			paths: {
				canonicalSpecPath,
				artifactRootDir,
				mediaOutputDir,
			},
			media: {
				enabled: parsedArgs.mediaEnabled,
			},
		});

		await executeRunDeckSpecValidateModule({
			canonicalSpecPath: result.canonicalSpecPath,
			reportPath,
		});

		io.stdout(`Live smoke passed for project: ${projectSlug}`);
		io.stdout(`Canonical spec: ${result.canonicalSpecPath}`);
		io.stdout(`Artifact bundle: ${result.artifactRootDir}`);
		if (parsedArgs.mediaEnabled) {
			io.stdout(`Generated media dir: ${mediaOutputDir}`);
		} else {
			io.stdout("Media phase skipped.");
		}
		io.stdout(`Validation report: ${reportPath}`);
		io.stdout(`Used fallback: ${result.usedFallback ? "yes" : "no"}`);
		return 0;
	} catch (error) {
		io.stderr(`Live smoke failed for project: ${projectSlug}`);
		io.stderr(`Failure kind: ${getFailureKind(error)}`);
		io.stderr(`Run root: ${runRootDir}`);
		if (getFailureKind(error) === "media_generation_failed") {
			io.stderr(`Canonical spec: ${canonicalSpecPath}`);
			io.stderr(`Artifact bundle: ${artifactRootDir}`);
			io.stderr(`Media output dir: ${mediaOutputDir}`);
		}
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
