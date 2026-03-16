import path from "node:path";

export const GENERATED_IMAGE_ASSETS_DIR_NAME = "generated-images";

export function resolveGeneratedImageAssetsDir(mediaOutputDir: string): string {
	return path.resolve(mediaOutputDir);
}

export function resolveGeneratedImageAssetPath(
	mediaOutputDir: string,
	outputFileName: string,
): string {
	return path.join(resolveGeneratedImageAssetsDir(mediaOutputDir), outputFileName);
}
