import process from "node:process";
import { pathToFileURL } from "node:url";

export { runSpecCli } from "../../../../packages/deck-spec-module/src/cli/runSpecCli.ts";

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { runSpecCli } = await import(
		"../../../../packages/deck-spec-module/src/cli/runSpecCli.ts"
	);
	const exitCode = await runSpecCli(process.argv.slice(2));
	process.exit(exitCode);
}
