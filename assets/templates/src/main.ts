import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const buildDeckSource = fileURLToPath(
	new URL("./buildDeck.ts", import.meta.url),
);
const presentationModelSource = fileURLToPath(
	new URL("./presentationModel.ts", import.meta.url),
);

if (!existsSync(buildDeckSource) || !existsSync(presentationModelSource)) {
	console.error(
		"Project scaffold is ready, but deck content has not been generated yet.",
	);
	console.error(
		"Create src/buildDeck.ts and src/presentationModel.ts from the user's prompt, then rerun `pnpm build`.",
	);
	process.exit(1);
}

const buildDeckModulePath = "./buildDeck.js";
const { writePresentation } = (await import(buildDeckModulePath)) as {
	writePresentation: () => Promise<{
		outputFile: string;
		slideCount: number;
	}>;
};

try {
	const result = await writePresentation();
	console.log(`Wrote ${result.outputFile} (${result.slideCount} slides)`);
} catch (error) {
	console.error(error);
	throw error;
}
