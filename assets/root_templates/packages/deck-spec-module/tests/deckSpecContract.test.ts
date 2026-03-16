import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { DeckSpec } from "../src/spec/contract.js";
import { deriveOutputFileName } from "../src/spec/deriveOutputFileName.js";
import { normalizeSystemManagedFields } from "../src/spec/normalizeSystemManagedFields.js";
import {
	runDeckSpecValidateModule,
	runSpecValidateCli,
	validateDeckSpecDocument,
} from "../src/public-api.js";
import { createProjectTempDir } from "./testTempDir.js";

const tempDirs: string[] = [];
const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const fixtureProjectSlug = "ai-native-product-deck";
const fixturePlanPath = path.join(
	projectRoot,
	"tests",
	"fixtures",
	"deck-spec.fixture.json",
);
const fixtureSchemaPath = path.join(
	projectRoot,
	"spec",
	"deck-spec.schema.json",
);

async function readJsonFile<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadFixturePlan(): Promise<DeckSpec> {
	return readJsonFile<DeckSpec>(fixturePlanPath);
}

async function loadFixtureSchema(): Promise<object> {
	return readJsonFile<object>(fixtureSchemaPath);
}

async function createTempProject(plan?: DeckSpec): Promise<string> {
	const tempRoot = await createProjectTempDir(
		projectRoot,
		"deck-spec-contract",
	);
	const tempProjectDir = path.join(tempRoot, fixtureProjectSlug);
	tempDirs.push(tempRoot);

	await mkdir(path.join(tempProjectDir, "spec"), { recursive: true });
	await copyFile(
		fixtureSchemaPath,
		path.join(tempProjectDir, "spec", "deck-spec.schema.json"),
	);

	if (plan) {
		await writeFile(
			path.join(tempProjectDir, "spec", "deck-spec.json"),
			`${JSON.stringify(plan, null, 2)}\n`,
			"utf8",
		);
	}

	return tempProjectDir;
}

function clonePlan(plan: DeckSpec): DeckSpec {
	return structuredClone(plan);
}

function resolveCanonicalSpecPath(projectDir: string): string {
	return path.join(projectDir, "spec", "deck-spec.json");
}

async function validatePlan(
	plan: DeckSpec,
): Promise<ReturnType<typeof validateDeckSpecDocument>> {
	const schema = await loadFixtureSchema();
	return validateDeckSpecDocument(plan, schema, {
		projectDir: `/virtual/${fixtureProjectSlug}`,
	});
}

afterEach(async () => {
	for (const tempDir of tempDirs) {
		await rm(tempDir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

describe("deck-spec contract", () => {
	it("accepts the canonical deck-spec fixture", async () => {
		const result = await validatePlan(await loadFixturePlan());

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("normalizes system-managed fields without mutating the input", async () => {
		const originalPlan = await loadFixturePlan();
		const mutatedPlan = clonePlan(originalPlan);
		mutatedPlan.project_slug = "wrong-project";
		mutatedPlan.asset_manifest.image_assets[0].output_file_name =
			"bad-name.jpg";

		const normalizedPlan = normalizeSystemManagedFields(mutatedPlan, {
			projectSlug: fixtureProjectSlug,
			sourcePrompt: mutatedPlan.source_prompt,
		});

		expect(normalizedPlan.project_slug).toBe(fixtureProjectSlug);
		expect(normalizedPlan.asset_manifest.image_assets[0].output_file_name).toBe(
			"overview_hero__hero_visual__large.jpg",
		);
		expect(mutatedPlan.asset_manifest.image_assets[0].output_file_name).toBe(
			"bad-name.jpg",
		);
	});

	it("derives stable output filenames independent of asset_label", async () => {
		const plan = await loadFixturePlan();
		const asset = {
			...plan.asset_manifest.image_assets[0],
			asset_label: "Completely different label",
		};

		expect(deriveOutputFileName(asset)).toBe(
			"overview_hero__hero_visual__large.jpg",
		);
	});

	it("rejects missing required fields", async () => {
		const plan = clonePlan(await loadFixturePlan()) as unknown as Record<
			string,
			unknown
		>;
		delete plan.source_prompt;

		const schema = await loadFixtureSchema();
		const result = validateDeckSpecDocument(plan, schema, {
			projectDir: `/virtual/${fixtureProjectSlug}`,
		});

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$",
				}),
			]),
		);
	});

	it("rejects empty objectives arrays", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slides[0].objectives = [];

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$/slides/0/objectives",
				}),
			]),
		);
	});

	it("rejects invalid enums", async () => {
		const plan = clonePlan(await loadFixturePlan());
		(plan as unknown as { status: string }).status = "done";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$/status",
				}),
			]),
		);
	});

	it("rejects duplicate asset ids", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.asset_manifest.image_assets[0].asset_id =
			plan.asset_manifest.text_assets[0].asset_id;

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("Duplicate asset_id"),
				}),
			]),
		);
	});

	it("rejects duplicate slide ids", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slides[1].slide_id = plan.slides[0].slide_id;

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("Duplicate slide_id"),
				}),
			]),
		);
	});

	it("rejects duplicate block ids", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slides[1].content_blocks[0].block_id =
			plan.slides[0].content_blocks[0].block_id;

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("Duplicate block_id"),
				}),
			]),
		);
	});

	it("rejects target_slide_count mismatches", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.target_slide_count = 9;

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$.target_slide_count",
				}),
			]),
		);
	});

	it("rejects slide_mapping drift from content_blocks", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slide_mapping[2].shared_asset_ids = [];

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$.slide_mapping[2].shared_asset_ids",
				}),
			]),
		);
	});

	it("rejects layout slots that are not allowed for a slide layout intent", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slides[1].content_blocks[0].layout_slot = "hero_visual";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("is not allowed for layout_intent"),
				}),
			]),
		);
	});

	it("rejects duplicate layout slots on the same slide", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slides[2].content_blocks[2].layout_slot = "primary_card";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("can only appear once"),
				}),
			]),
		);
	});

	it("rejects block types that do not match a layout slot contract", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.slides[0].content_blocks[0] = {
			block_id: "hero_badge_block",
			block_type: "text",
			layout_slot: "eyebrow_badge",
			text_asset_id: "hero_badge",
		};

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("only accepts badge"),
				}),
			]),
		);
	});

	it("rejects block and text asset kind mismatches", async () => {
		const plan = clonePlan(await loadFixturePlan());
		const bulletBlock = plan.slides[2].content_blocks.find(
			(block) => block.block_id === "adoption_bullets_block",
		);

		if (!bulletBlock || !("text_asset_id" in bulletBlock)) {
			throw new Error("Expected bullet list block in fixture.");
		}

		bulletBlock.text_asset_id = "hero_badge";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('must be "bullet_list"'),
				}),
			]),
		);
	});

	it("rejects image references that point at another slide's asset", async () => {
		const plan = clonePlan(await loadFixturePlan());
		const imageBlock = plan.slides[0].content_blocks.find(
			(block) => block.block_id === "hero_visual_block",
		);

		if (!imageBlock || !("image_asset_id" in imageBlock)) {
			throw new Error("Expected image block in fixture.");
		}

		imageBlock.image_asset_id = "metrics_support_visual";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("belongs to slide"),
				}),
			]),
		);
	});

	it("rejects output filenames that do not match the deterministic derivation", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.asset_manifest.shared_assets[0].output_file_name = "shared_grid.jpg";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$.asset_manifest.shared_assets[0].output_file_name",
				}),
			]),
		);
	});

	it("rejects project_slug values that do not match the project directory basename", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.project_slug = "different-project";

		const result = await validatePlan(plan);

		expect(result.ok).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "$.project_slug",
				}),
			]),
		);
	});
});

describe("spec:validate CLI", () => {
	it("returns exit code 0 for a valid deck spec", async () => {
		const tempProjectDir = await createTempProject(await loadFixturePlan());
		const stdout: string[] = [];
		const stderr: string[] = [];

		const exitCode = await runSpecValidateCli([tempProjectDir], {
			stdout: (message) => stdout.push(message),
			stderr: (message) => stderr.push(message),
		});

		expect(exitCode).toBe(0);
		expect(stderr).toEqual([]);
		expect(stdout[0]).toContain("Deck spec is valid");
	});

	it("returns exit code 1 for an invalid deck spec fixture", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.target_slide_count = 1;
		const tempProjectDir = await createTempProject(plan);
		const stdout: string[] = [];
		const stderr: string[] = [];

		const exitCode = await runSpecValidateCli([tempProjectDir], {
			stdout: (message) => stdout.push(message),
			stderr: (message) => stderr.push(message),
		});

		expect(exitCode).toBe(1);
		expect(stdout).toEqual([]);
		expect(stderr[0]).toContain("Deck spec validation failed");
	});

	it("returns exit code 1 with a clear error when deck-spec.json is missing", async () => {
		const tempProjectDir = await createTempProject();
		const stdout: string[] = [];
		const stderr: string[] = [];

		const exitCode = await runSpecValidateCli([tempProjectDir], {
			stdout: (message) => stdout.push(message),
			stderr: (message) => stderr.push(message),
		});

		expect(exitCode).toBe(1);
		expect(stdout).toEqual([]);
		expect(stderr[0]).toContain("deck-spec.json is missing");
	});
});

describe("runDeckSpecValidateModule", () => {
	it("accepts a valid canonical spec path", async () => {
		const tempProjectDir = await createTempProject(await loadFixturePlan());

		await expect(
			runDeckSpecValidateModule({
				canonicalSpecPath: resolveCanonicalSpecPath(tempProjectDir),
			}),
		).resolves.toEqual({ ok: true });
	});

	it("rejects invalid canonical spec documents", async () => {
		const plan = clonePlan(await loadFixturePlan());
		plan.target_slide_count = 1;
		const tempProjectDir = await createTempProject(plan);

		await expect(
			runDeckSpecValidateModule({
				canonicalSpecPath: resolveCanonicalSpecPath(tempProjectDir),
			}),
		).rejects.toThrow("Deck spec validation failed");
	});

	it("rejects missing canonical spec files", async () => {
		const tempProjectDir = await createTempProject();

		await expect(
			runDeckSpecValidateModule({
				canonicalSpecPath: resolveCanonicalSpecPath(tempProjectDir),
			}),
		).rejects.toThrow("deck-spec.json is missing");
	});

	it("writes an optional validation report", async () => {
		const tempProjectDir = await createTempProject(await loadFixturePlan());
		const reportPath = path.join(tempProjectDir, "validate.report.md");

		await expect(
			runDeckSpecValidateModule({
				canonicalSpecPath: resolveCanonicalSpecPath(tempProjectDir),
				reportPath,
			}),
		).resolves.toEqual({ ok: true });

		const report = await readFile(reportPath, "utf8");
		expect(report).toContain("# Deck-Spec Validation");
		expect(report).toContain("- Status: VALID");
		expect(report).toContain(resolveCanonicalSpecPath(tempProjectDir));
	});
});
