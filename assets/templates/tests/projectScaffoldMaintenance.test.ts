import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function createTempWorkspaceDir(prefix: string): Promise<string> {
	const tmpRoot = path.join(deckRoot, "tmp");
	await mkdir(tmpRoot, { recursive: true });
	const tempDir = await mkdtemp(path.join(tmpRoot, prefix));
	tempProjectDirs.push(tempDir);
	return tempDir;
}

async function writeExecutable(
	filePath: string,
	source: string,
): Promise<void> {
	await writeFile(filePath, source, "utf8");
	await chmod(filePath, 0o755);
}

async function createFakeToolchain(): Promise<{
	binDir: string;
	pnpmLogPath: string;
	unzipLogPath: string;
}> {
	const toolRoot = await createTempWorkspaceDir("validate-local-tools-");
	const binDir = path.join(toolRoot, "bin");
	const pnpmLogPath = path.join(toolRoot, "pnpm.log");
	const unzipLogPath = path.join(toolRoot, "unzip.log");

	await mkdir(binDir, { recursive: true });

	await writeExecutable(
		path.join(binDir, "pnpm"),
		`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_PNPM_LOG_PATH"
command_name="\${1:-}"
shift || true

case "$command_name" in
  lint|typecheck|test)
    exit 0
    ;;
  build)
    if [[ "\${FAKE_BUILD_MODE:-success}" == "fail" ]]; then
      echo "intentional build failure" >&2
      exit 1
    fi

    output_dir="$PWD/output"
    build_dir="$PWD/tmp/fake-build-output"
    mkdir -p "$build_dir/ppt" "$output_dir"
    printf '<a:off x="1" y="1"/>\\n' > "$build_dir/ppt/presentation.xml"
    rm -f "$output_dir/$FAKE_BUILD_OUTPUT_BASENAME"
    (
      cd "$build_dir"
      /usr/bin/zip -qr "$output_dir/$FAKE_BUILD_OUTPUT_BASENAME" .
    )
    echo "Wrote $output_dir/$FAKE_BUILD_OUTPUT_BASENAME (1 slides)"
    ;;
  *)
    echo "unsupported pnpm command: $command_name" >&2
    exit 1
    ;;
esac
`,
	);

	await writeExecutable(
		path.join(binDir, "uv"),
		`#!/usr/bin/env bash
set -euo pipefail
echo "uv 0.0.0-test"
`,
	);
	await writeExecutable(
		path.join(binDir, "soffice"),
		`#!/usr/bin/env bash
set -euo pipefail
echo "LibreOffice 0.0.0-test"
`,
	);
	await writeExecutable(
		path.join(binDir, "pdfinfo"),
		`#!/usr/bin/env bash
set -euo pipefail
echo "pdfinfo test"
`,
	);
	await writeExecutable(
		path.join(binDir, "pdftoppm"),
		`#!/usr/bin/env bash
set -euo pipefail
echo "pdftoppm test"
`,
	);
	await writeExecutable(
		path.join(binDir, "unzip"),
		`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_UNZIP_LOG_PATH"
exec /usr/bin/unzip "$@"
`,
	);

	return {
		binDir,
		pnpmLogPath,
		unzipLogPath,
	};
}

async function writeMinimalPptx(pptxPath: string): Promise<void> {
	const sourceDir = await createTempWorkspaceDir("validate-local-pptx-");
	await mkdir(path.join(sourceDir, "ppt"), { recursive: true });
	await writeFile(
		path.join(sourceDir, "ppt", "presentation.xml"),
		'<a:off x="1" y="1"/>\n',
		"utf8",
	);
	await mkdir(path.dirname(pptxPath), { recursive: true });
	await execFileAsync("/usr/bin/zip", ["-qr", pptxPath, "."], {
		cwd: sourceDir,
	});
}

async function runValidateLocalScript(
	projectDir: string,
	options: {
		buildMode: "success" | "fail";
		buildOutputBasename: string;
	},
): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
	reportPath: string;
	unzipLogPath: string;
}> {
	const toolchain = await createFakeToolchain();
	const validateScript = path.join(projectDir, "validate-local.sh");
	const reportPath = path.join(
		projectDir,
		"output",
		`${path.basename(projectDir)}-validation.md`,
	);

	try {
		const result = await execFileAsync("bash", [validateScript], {
			cwd: projectDir,
			env: {
				...process.env,
				CODEX_SHELL: "1",
				FAKE_BUILD_MODE: options.buildMode,
				FAKE_BUILD_OUTPUT_BASENAME: options.buildOutputBasename,
				FAKE_PNPM_LOG_PATH: toolchain.pnpmLogPath,
				FAKE_UNZIP_LOG_PATH: toolchain.unzipLogPath,
				PATH: `${toolchain.binDir}:${process.env.PATH ?? ""}`,
			},
		});

		return {
			exitCode: 0,
			stdout: result.stdout,
			stderr: result.stderr,
			reportPath,
			unzipLogPath: toolchain.unzipLogPath,
		};
	} catch (error) {
		const execError = error as Error & {
			code?: number;
			stdout?: string;
			stderr?: string;
		};

		return {
			exitCode: typeof execError.code === "number" ? execError.code : 1,
			stdout: execError.stdout ?? "",
			stderr: execError.stderr ?? "",
			reportPath,
			unzipLogPath: toolchain.unzipLogPath,
		};
	}
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

	it("routes operator CLI entrypoints through package pnpm scripts", async () => {
		const projectDir = await createBootstrappedTempProject();
		const runProjectSource = await readFile(
			path.join(projectDir, "run-project.sh"),
			"utf8",
		);
		const deckRootPackage = JSON.parse(
			await readFile(path.join(deckRoot, "package.json"), "utf8"),
		) as {
			scripts?: Record<string, unknown>;
		};

		expect(runProjectSource).toContain(
			'pnpm --dir "$DECK_ROOT/packages/deck-spec-module" spec "$PROJECT_DIR"',
		);
		expect(runProjectSource).not.toContain(
			'packages/deck-spec-module/src/cli/runSpecCli.ts',
		);
		expect(deckRootPackage.scripts).toMatchObject({
			"spec:live": "pnpm --dir packages/deck-spec-module spec:live",
		});
	});

	it(
		"stops validation before artifact checks when build fails",
		async () => {
		const projectDir = await createBootstrappedTempProject();
		const result = await runValidateLocalScript(projectDir, {
			buildMode: "fail",
			buildOutputBasename: "fresh-build.pptx",
		});

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Validation completed with failures.");

		const report = await readFile(result.reportPath, "utf8");
		expect(report).toContain("## Build Deck");
		expect(report).toContain(
			"Skipped because Build Deck did not produce a fresh PPTX to validate.",
		);
		expect(report).not.toContain("## Fresh Build Artifact");
		expect(existsSync(result.unzipLogPath)).toBe(false);
		},
		20_000,
	);

	it(
		"uses the fresh build artifact instead of older output files",
		async () => {
		const projectDir = await createBootstrappedTempProject();
		const outputDir = path.join(projectDir, "output");
		const oldArtifactA = path.join(outputDir, "old-a.pptx");
		const oldArtifactB = path.join(outputDir, "old-b.pptx");
		const freshArtifact = path.join(outputDir, "fresh-build.pptx");

		await writeMinimalPptx(oldArtifactA);
		await writeMinimalPptx(oldArtifactB);

		const result = await runValidateLocalScript(projectDir, {
			buildMode: "success",
			buildOutputBasename: path.basename(freshArtifact),
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(
			"Validation incomplete. Human-in-the-loop steps remain.",
		);

		const report = await readFile(result.reportPath, "utf8");
		expect(report).toContain("## Fresh Build Artifact");
		expect(report).toContain(`- PPTX: ${freshArtifact}`);
		expect(report).not.toContain("old-a.pptx");
		expect(report).not.toContain("old-b.pptx");

		const unzipLog = await readFile(result.unzipLogPath, "utf8");
		expect(unzipLog).toContain(freshArtifact);
		},
		20_000,
	);
});
