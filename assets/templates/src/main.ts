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
		"Project scaffold is ready, but second-stage deck authoring has not finished yet.",
	);
	console.error(
		'Run `pnpm spec -- --prompt "<prompt>"` first if canonical spec, generated media, or module artifacts are still missing.',
	);
	console.error(
		"Then author src/buildDeck.ts and src/presentationModel.ts from the original prompt plus those artifacts before rerunning `pnpm build`.",
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
