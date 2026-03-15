import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function resolveWorkspaceCacheDir(): string {
	let currentDir = path.dirname(fileURLToPath(import.meta.url));

	while (currentDir !== path.dirname(currentDir)) {
		if (existsSync(path.join(currentDir, ".ai-native-slides", "root.json"))) {
			return path.join(currentDir, "tmp", ".vite", "deck-spec-module");
		}
		if (existsSync(path.join(currentDir, ".git"))) {
			return path.join(currentDir, ".tmp", ".vite", "deck-spec-module");
		}
		currentDir = path.dirname(currentDir);
	}

	return path.join(path.dirname(fileURLToPath(import.meta.url)), ".tmp", ".vite");
}

export default defineConfig({
	cacheDir: resolveWorkspaceCacheDir(),
	test: {
		include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
	},
});
