import process from "node:process";
import { pathToFileURL } from "node:url";

export {
	runSpecValidateCli,
	type DeckSpecValidationError,
	type DeckSpecValidationResult,
	validateDeckSpecDocument,
	validateDeckSpecFile,
	validateDeckSpecFileFromPath,
} from "../../../../packages/deck-spec-module/src/public-api.ts";

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { runSpecValidateCli } = await import(
		"../../../../packages/deck-spec-module/src/public-api.ts"
	);
	const exitCode = await runSpecValidateCli(process.argv.slice(2));
	process.exit(exitCode);
}
