import { writePresentation } from "./buildDeck.js";

try {
	const result = await writePresentation();
	console.log(`Wrote ${result.outputFile} (${result.slideCount} slides)`);
} catch (error) {
	console.error(error);
	throw error;
}
