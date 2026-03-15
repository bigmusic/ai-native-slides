import process from "node:process";
import { pathToFileURL } from "node:url";

export * from "../../../../packages/deck-spec-module/src/spec/validateDeckSpec.ts";
export {
	runValidateCli as runSpecValidateCli,
} from "../../../../packages/deck-spec-module/src/cli/runValidateCli.ts";

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { runValidateCli } = await import(
		"../../../../packages/deck-spec-module/src/cli/runValidateCli.ts"
	);
	const exitCode = await runValidateCli(process.argv.slice(2));
	process.exit(exitCode);
}
