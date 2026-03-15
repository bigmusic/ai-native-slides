import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

import type { DeckSpec } from "./contract.js";
import {
	createExistingSpecSummary,
	createPlannerContext,
	type ExistingSpecSummary,
	renderPlannerBriefMarkdown,
} from "./plannerContext.js";
import {
	readDeckSpec,
	resolveDeckSpecPath,
	resolvePlannerBriefPath,
	resolvePlannerContextPath,
	resolveProjectDir,
} from "./readDeckSpec.js";
import { type CliIo, validateDeckSpecFile } from "./validateDeckSpec.js";
import { writeJsonFileAtomic, writeTextFileAtomic } from "./writeFileAtomic.js";

type GeneratePlannerBriefResult =
	| {
			ok: true;
			contextPath: string;
			briefPath: string;
			candidatePath: string;
			warnings: string[];
	  }
	| {
			ok: false;
			message: string;
	  };

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

type ParsedCliArgs = {
	projectDir: string;
	prompt?: string;
};

function parseCliArgs(args: string[]): ParsedCliArgs | { error: string } {
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

export async function generatePlannerBrief(
	projectDir: string,
	sourcePrompt: string,
): Promise<GeneratePlannerBriefResult> {
	const resolvedProjectDir = resolveProjectDir(projectDir);
	const trimmedPrompt = sourcePrompt.trim();

	if (trimmedPrompt.length === 0) {
		return {
			ok: false,
			message: "Missing required --prompt value.",
		};
	}

	const contextPath = resolvePlannerContextPath(resolvedProjectDir);
	const briefPath = resolvePlannerBriefPath(resolvedProjectDir);
	const candidatePath = createPlannerContext(resolvedProjectDir, trimmedPrompt)
		.paths.spec_candidate_path;
	const specPath = resolveDeckSpecPath(resolvedProjectDir);
	const warnings: string[] = [];
	let existingSpecSummary: ExistingSpecSummary | undefined;

	try {
		if (existsSync(specPath)) {
			const validationResult = await validateDeckSpecFile(resolvedProjectDir);
			if (validationResult.ok) {
				const spec = (await readDeckSpec(resolvedProjectDir)) as DeckSpec;
				existingSpecSummary = createExistingSpecSummary(spec);
			} else {
				warnings.push(
					`Existing canonical spec is invalid at ${specPath}. spec:generate continued, but the brief omits a trusted existing-spec summary.`,
				);
			}
		}
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: `Unknown error: ${String(error)}`;
		warnings.push(
			`Could not load a valid canonical spec summary from ${specPath}: ${message}`,
		);
	}

	const context = createPlannerContext(resolvedProjectDir, trimmedPrompt, {
		existingSpecSummary,
		warnings,
	});
	await writeJsonFileAtomic(contextPath, context);
	await writeTextFileAtomic(
		briefPath,
		`${renderPlannerBriefMarkdown(context)}\n`,
	);

	return {
		ok: true,
		contextPath,
		briefPath,
		candidatePath,
		warnings,
	};
}

export async function runSpecGenerateCli(
	args: string[],
	io: CliIo = defaultCliIo,
): Promise<number> {
	const parsedArgs = parseCliArgs(args);
	if ("error" in parsedArgs) {
		io.stderr(parsedArgs.error);
		io.stderr('Usage: pnpm spec:generate -- --prompt "<prompt>"');
		return 1;
	}

	if (typeof parsedArgs.prompt !== "string") {
		io.stderr("Missing required --prompt value.");
		io.stderr('Usage: pnpm spec:generate -- --prompt "<prompt>"');
		return 1;
	}

	try {
		const result = await generatePlannerBrief(
			parsedArgs.projectDir,
			parsedArgs.prompt,
		);
		if (!result.ok) {
			io.stderr(result.message);
			return 1;
		}

		io.stdout(`Planner context written: ${result.contextPath}`);
		io.stdout(`Planner brief written: ${result.briefPath}`);
		io.stdout(`Candidate target: ${result.candidatePath}`);
		for (const warning of result.warnings) {
			io.stderr(warning);
		}
		return 0;
	} catch (error) {
		io.stderr(
			error instanceof Error
				? error.message
				: `Unknown error: ${String(error)}`,
		);
		return 1;
	}
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runSpecGenerateCli(process.argv.slice(2));
	process.exit(exitCode);
}
