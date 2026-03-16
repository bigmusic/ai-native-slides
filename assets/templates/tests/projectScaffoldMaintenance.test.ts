import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const tempProjectDirs: string[] = [];
const projectRoot = path.resolve(import.meta.dirname, "..");
const deckRoot = path.resolve(projectRoot, "..", "..");

async function resolveSkillRoot(): Promise<string> {
	const statePath = path.join(projectRoot, ".ai-native-slides", "state.json");
	const state = JSON.parse(await readFile(statePath, "utf8")) as {
		skill_dir?: unknown;
	};

	if (typeof state.skill_dir !== "string" || state.skill_dir.trim() === "") {
		throw new Error(`Missing skill_dir in ${statePath}.`);
	}

	return state.skill_dir;
}

async function createBootstrappedTempProject(): Promise<string> {
	const skillRoot = await resolveSkillRoot();
	const projectsDir = path.join(deckRoot, "projects");
	await mkdir(projectsDir, { recursive: true });
	const projectDir = await mkdtemp(path.join(projectsDir, "legacy-cleanup-"));
	tempProjectDirs.push(projectDir);

	await execFileAsync(
		"bash",
		[
			path.join(skillRoot, "scripts", "bootstrap_deck_project.sh"),
			projectDir,
			"--force",
		],
		{
			cwd: deckRoot,
		},
	);

	return projectDir;
}

afterEach(async () => {
	for (const projectDir of tempProjectDirs) {
		await rm(projectDir, { recursive: true, force: true });
	}
	tempProjectDirs.length = 0;
});

describe("project scaffold maintenance surfaces", () => {
	it("does not expose retired source-tree legacy metadata after bootstrap", async () => {
		const projectDir = await createBootstrappedTempProject();
		const metadataPath = path.join(
			projectDir,
			".ai-native-slides",
			"project.json",
		);
		const statePath = path.join(projectDir, ".ai-native-slides", "state.json");

		const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Record<
			string,
			unknown
		>;
		const state = JSON.parse(await readFile(statePath, "utf8")) as {
			status: Record<string, unknown>;
		};

		expect(metadata).not.toHaveProperty("legacy_cleanup_targets");
		expect(state.status).not.toHaveProperty("legacy_asset_pipeline_present");
		expect(state.status).not.toHaveProperty("legacy_media_provider_present");
		expect(state.status).not.toHaveProperty("legacy_planner_agent_present");
		expect(state.status).not.toHaveProperty("legacy_spec_compat_present");
	});

	it("does not treat the scaffold maintenance test as generated project content", async () => {
		const projectDir = await createBootstrappedTempProject();

		await expect(
			execFileAsync("bash", [
				path.join(projectDir, "run-project.sh"),
				"test",
				"--",
				"projectScaffoldMaintenance.test.ts",
			]),
		).rejects.toMatchObject({
			stderr: expect.stringContaining("no TypeScript tests exist yet"),
		});
	});
});
