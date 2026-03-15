import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	findDeckRootForProject,
	resolveProjectDir,
} from "../../spec/readDeckSpec.js";

type NodeStyleError = Error & {
	code?: string;
};

type ResolveGeminiApiKeyOptions = {
	processEnv?: NodeJS.ProcessEnv;
	readTextFile?: typeof readFile;
};

export const GEMINI_API_KEY_ENV_NAME = "GEMINI_API_KEY";

export type GeminiApiKeyResolution = {
	apiKey: string;
	deckRoot?: string;
	envPath?: string;
	source: "process_env" | "deck_root_env";
};

function stripWrappingQuotes(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}

export function parseDotEnv(text: string): Record<string, string> {
	return text.split(/\r?\n/).reduce<Record<string, string>>((acc, rawLine) => {
		const line = rawLine.trim();
		if (line === "" || line.startsWith("#")) {
			return acc;
		}

		const match = line.match(
			/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
		);
		if (!match) {
			return acc;
		}

		const [, key, rawValue] = match;
		const withoutInlineComment =
			rawValue.startsWith('"') || rawValue.startsWith("'")
				? rawValue
				: rawValue.replace(/\s+#.*$/, "");
		acc[key] = stripWrappingQuotes(withoutInlineComment.trim());
		return acc;
	}, {});
}

function readProcessEnv(processEnv: NodeJS.ProcessEnv): string | undefined {
	const apiKey = processEnv[GEMINI_API_KEY_ENV_NAME]?.trim();
	return apiKey === "" ? undefined : apiKey;
}

export async function resolveGeminiApiKey(
	projectDir: string,
	options: ResolveGeminiApiKeyOptions = {},
): Promise<GeminiApiKeyResolution> {
	const processEnv = options.processEnv ?? process.env;
	const processEnvKey = readProcessEnv(processEnv);

	if (processEnvKey) {
		return {
			apiKey: processEnvKey,
			source: "process_env",
		};
	}

	const deckRoot = findDeckRootForProject(resolveProjectDir(projectDir));
	if (typeof deckRoot !== "string") {
		throw new Error(
			`Could not find the shared deck root above project: ${resolveProjectDir(projectDir)}.`,
		);
	}
	const envPath = resolveDeckRootEnvPath(deckRoot);
	const readTextFile = options.readTextFile ?? readFile;

	try {
		const envDocument = await readTextFile(envPath, "utf8");
		const envValues = parseDotEnv(envDocument);
		const envFileKey = envValues[GEMINI_API_KEY_ENV_NAME]?.trim();

		if (envFileKey) {
			return {
				apiKey: envFileKey,
				deckRoot,
				envPath,
				source: "deck_root_env",
			};
		}
	} catch (error) {
		const nodeError = error as NodeStyleError;
		if (nodeError.code !== "ENOENT") {
			throw new Error(
				`Could not read deck-root .env at ${envPath}: ${nodeError.message}`,
			);
		}
	}

	throw new Error(
		`Missing ${GEMINI_API_KEY_ENV_NAME}. Set it in the current shell or add it to ${envPath}.`,
	);
}

function resolveDeckRootEnvPath(deckRoot: string): string {
	return path.join(deckRoot, ".env");
}
