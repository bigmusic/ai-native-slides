import process from "node:process";
import { pathToFileURL } from "node:url";

export {
	type DeckSpecValidationError,
	type DeckSpecValidationResult,
	runSpecValidateCli,
	validateDeckSpecDocument,
	validateDeckSpecFile,
	validateDeckSpecFileFromPath,
} from "@ai-native-slides/deck-spec-module";

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { runSpecValidateCli } = await import(
		"@ai-native-slides/deck-spec-module"
	);
	const exitCode = await runSpecValidateCli(process.argv.slice(2));
	process.exit(exitCode);
}
