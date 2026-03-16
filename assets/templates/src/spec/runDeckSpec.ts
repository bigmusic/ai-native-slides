import process from "node:process";
import { pathToFileURL } from "node:url";

export { runSpecCli } from "@ai-native-slides/deck-spec-module";

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { runSpecCli } = await import("@ai-native-slides/deck-spec-module");
	const exitCode = await runSpecCli(process.argv.slice(2));
	process.exit(exitCode);
}
