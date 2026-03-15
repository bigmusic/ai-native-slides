import { existsSync } from "node:fs";
import path from "node:path";

import { resolveProjectDir } from "../spec/readDeckSpec.js";

export const GENERATED_IMAGE_ASSETS_DIR_NAME = "generated-images";

const ROOT_MARKER_FILE = path.join(".ai-native-slides", "root.json");

export function findDeckRootForProject(projectDir: string): string {
	let currentDir = resolveProjectDir(projectDir);
	const { root } = path.parse(currentDir);

	while (true) {
		if (existsSync(path.join(currentDir, ROOT_MARKER_FILE))) {
			return currentDir;
		}

		if (currentDir === root) {
			break;
		}

		currentDir = path.dirname(currentDir);
	}

	throw new Error(
		`Could not find the shared deck root above project: ${resolveProjectDir(projectDir)}.`,
	);
}

export function resolveDeckRootEnvPath(deckRoot: string): string {
	return path.join(deckRoot, ".env");
}

export function resolveGeneratedImageAssetsDir(projectDir: string): string {
	return path.join(
		resolveProjectDir(projectDir),
		"media",
		GENERATED_IMAGE_ASSETS_DIR_NAME,
	);
}

export function resolveGeneratedImageAssetPath(
	projectDir: string,
	outputFileName: string,
): string {
	return path.join(resolveGeneratedImageAssetsDir(projectDir), outputFileName);
}
