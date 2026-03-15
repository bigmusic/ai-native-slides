import { pathToFileURL } from "node:url";

import type { DeckSpec } from "./contract.js";
import {
	readDeckSpec,
	readJsonFile,
	resolveDeckSpecPath,
	resolveProjectDir,
	resolveSpecReviewCandidatePath,
	resolveSpecReviewMarkdownPath,
	resolveSpecReviewPath,
} from "./readDeckSpec.js";
import { renderSpecReviewMarkdown } from "./renderSpecReview.js";
import type { SpecReviewResult } from "./reviewContract.js";
import { type CliIo, validateDeckSpecFile } from "./validateDeckSpec.js";
import {
	type SpecReviewValidationError,
	validateSpecReviewDocument,
} from "./validateSpecReview.js";
import { writeJsonFileAtomic, writeTextFileAtomic } from "./writeFileAtomic.js";

type PromoteSpecReviewResult =
	| {
			ok: true;
			reviewPath: string;
			markdownPath: string;
			status: SpecReviewResult["status"];
			specPath: string;
	  }
	| {
			ok: false;
			reviewPath: string;
			markdownPath: string;
			specPath: string;
			status?: SpecReviewResult["status"];
			message?: string;
			errors?: SpecReviewValidationError[];
	  };

const defaultCliIo: CliIo = {
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};
const specReviewDeprecationMessage =
	'Deprecated: `pnpm spec:review` is a transition-only compatibility/debug command. Semantic review for the main prompt-driven workflow now runs inside `pnpm spec -- --prompt "<prompt>"`.';

function getCliErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: `Unknown error: ${String(error)}`;
}

async function writeReviewedDeckSpecStatus(projectDir: string): Promise<void> {
	const deckSpec = (await readDeckSpec(projectDir)) as DeckSpec;
	await writeJsonFileAtomic(resolveDeckSpecPath(projectDir), {
		...deckSpec,
		status: "reviewed",
	});
}

export async function promoteSpecReviewCandidate(
	projectDir: string,
): Promise<PromoteSpecReviewResult> {
	const specPath = resolveDeckSpecPath(projectDir);
	const candidatePath = resolveSpecReviewCandidatePath(projectDir);
	const reviewPath = resolveSpecReviewPath(projectDir);
	const markdownPath = resolveSpecReviewMarkdownPath(projectDir);

	try {
		const deckSpec = (await readDeckSpec(projectDir)) as DeckSpec;
		const reviewCandidate = await readJsonFile(
			candidatePath,
			"spec review candidate",
		);
		const validationResult = validateSpecReviewDocument(reviewCandidate, {
			deckSpec,
		});

		if (!validationResult.ok) {
			return {
				ok: false,
				reviewPath,
				markdownPath,
				specPath,
				errors: validationResult.errors,
			};
		}

		const review = reviewCandidate as SpecReviewResult;
		await writeJsonFileAtomic(reviewPath, review);
		await writeTextFileAtomic(
			markdownPath,
			`${renderSpecReviewMarkdown(review)}\n`,
		);

		if (review.status === "pass" || review.status === "warn") {
			await writeReviewedDeckSpecStatus(projectDir);
			const persistedValidation = await validateDeckSpecFile(projectDir);
			if (!persistedValidation.ok) {
				return {
					ok: false,
					reviewPath,
					markdownPath,
					specPath,
					status: review.status,
					errors: persistedValidation.errors,
				};
			}
		}

		return {
			ok: true,
			reviewPath,
			markdownPath,
			status: review.status,
			specPath,
		};
	} catch (error) {
		return {
			ok: false,
			reviewPath,
			markdownPath,
			specPath,
			message: getCliErrorMessage(error),
		};
	}
}

export async function runSpecReviewCli(
	args: string[],
	io: CliIo = defaultCliIo,
): Promise<number> {
	io.stderr(specReviewDeprecationMessage);
	const projectDir = resolveProjectDir(args[0]);
	const result = await promoteSpecReviewCandidate(projectDir);

	if (!result.ok) {
		io.stderr(
			`Spec review promotion failed: ${resolveSpecReviewCandidatePath(projectDir)}`,
		);
		io.stderr(`Review JSON target: ${result.reviewPath}`);
		io.stderr(`Review Markdown target: ${result.markdownPath}`);
		if (result.message) {
			io.stderr(result.message);
		}
		if (result.errors) {
			for (const error of result.errors) {
				io.stderr(`- ${error.path}: ${error.message}`);
			}
		}
		return 1;
	}

	io.stdout(`Spec review promoted: ${result.reviewPath}`);
	io.stdout(`Markdown report: ${result.markdownPath}`);
	if (result.status === "fail") {
		io.stderr(`Spec review status is FAIL for: ${result.specPath}`);
		return 2;
	}

	io.stdout(`Deck spec marked as reviewed: ${result.specPath}`);
	return 0;
}

if (
	typeof process.argv[1] === "string" &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const exitCode = await runSpecReviewCli(process.argv.slice(2));
	process.exit(exitCode);
}
