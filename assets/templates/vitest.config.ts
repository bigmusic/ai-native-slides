import { defineConfig } from "vitest/config";

export default defineConfig({
	cacheDir: "./tmp/.vite",
	test: {
		include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
	},
});
