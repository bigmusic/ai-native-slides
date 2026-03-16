import path from "node:path";

import { resolveProjectDir } from "../spec/readDeckSpec.js";

export const GENERATED_IMAGE_ASSETS_DIR_NAME = "generated-images";

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
