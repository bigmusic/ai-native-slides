import { existsSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";

function findWorkspaceTempBase(projectRoot: string): string {
	let currentDir = path.resolve(projectRoot);

	while (currentDir !== path.dirname(currentDir)) {
		if (existsSync(path.join(currentDir, ".ai-native-slides", "root.json"))) {
			return path.join(currentDir, "tmp", "deck-spec-module-tests");
		}
		if (existsSync(path.join(currentDir, ".git"))) {
			return path.join(currentDir, ".tmp", "deck-spec-module-tests");
		}
		currentDir = path.dirname(currentDir);
	}

	return path.join(projectRoot, ".tmp", "deck-spec-module-tests");
}

export async function createProjectTempDir(
	projectRoot: string,
	prefix: string,
): Promise<string> {
	const tempBaseDir = findWorkspaceTempBase(projectRoot);
	await mkdir(tempBaseDir, { recursive: true });
	return mkdtemp(path.join(tempBaseDir, `${prefix}-`));
}
