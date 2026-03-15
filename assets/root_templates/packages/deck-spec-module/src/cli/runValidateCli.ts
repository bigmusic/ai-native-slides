import process from "node:process";
import { pathToFileURL } from "node:url";

import { runDeckSpecValidateModule } from "../public-api.js";
import { resolveDeckSpecPath, resolveProjectDir } from "../spec/readDeckSpec.js";

type CliIo = {
	stdout: (message: string) => void;
	stderr: (message: string) => void;
};

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

export async function runValidateCli(
	args: string[],
	io: CliIo = defaultCliIo,
): Promise<number> {
	const projectDir = resolveProjectDir(args[0]);
	const canonicalSpecPath = resolveDeckSpecPath(projectDir);

	try {
		await runDeckSpecValidateModule({
			canonicalSpecPath,
		});
		io.stdout(`Deck spec is valid: ${canonicalSpecPath}`);
		return 0;
	} catch (error) {
		io.stderr(
			error instanceof Error
				? error.message
				: `Unknown error: ${String(error)}`,
		);
		return 1;
	}
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runValidateCli(process.argv.slice(2));
	process.exit(exitCode);
}
