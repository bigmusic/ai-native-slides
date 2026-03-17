import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import deckSpecSchema from "../spec/deck-spec.schema.json" with {
	type: "json",
};

import {
	createDeterministicSemanticReview,
	type AssetFailure,
	type GeneratedAssetManifestEntry,
	type PlanDeckSpecRunResult,
} from "../src/public-testing.js";
import {
	type DeckSpecPlanningDiagnostics,
	DeckSpecPlanningError,
	type PlanningAttemptDiagnostics,
	runDeckSpecModule,
} from "../src/public-api.js";
import type { DeckSpec } from "../src/spec/contract.js";
import { normalizeSystemManagedFields } from "../src/spec/normalizeSystemManagedFields.js";
import {
	resolveModuleFallbackCandidatePath,
	resolveModuleGeneratedAssetsManifestPath,
	resolveModuleMediaFailuresPath,
	resolveModuleMediaResultPath,
	resolveModulePrimaryCandidatePath,
	resolveModuleReportPath,
	resolveModuleResultPath,
	resolveModuleReviewPath,
} from "../src/spec/readDeckSpec.js";
import { validateDeckSpecDocument } from "../src/spec/validateDeckSpec.js";
import {
	createPlanCandidateFromScenarioPlan,
	loadDeckSpecBaselinePlan,
} from "./deckSpecScenarioFixtures.js";
import { createProjectTempDir } from "./testTempDir.js";

const tempDirs: string[] = [];
const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
type RunDeckSpecModuleDependencies = NonNullable<
	Parameters<typeof runDeckSpecModule>[1]
>;
type FakePlanDeckSpecRun = NonNullable<
	RunDeckSpecModuleDependencies["planDeckSpecRun"]
>;
type FakeMaterializeDeckSpecMedia = NonNullable<
	RunDeckSpecModuleDependencies["materializeDeckSpecMedia"]
>;
type SuccessfulPlanDeckSpecRunResult = Extract<PlanDeckSpecRunResult, { ok: true }>;
type FailedPlanDeckSpecRunResult = Extract<PlanDeckSpecRunResult, { ok: false }>;
type MaterializeDeckSpecMediaResult = {
	ok: boolean;
	deckSpec: DeckSpec;
	generatedAssetIds: string[];
	unchangedAssetIds: string[];
	failures: AssetFailure[];
	manifest: GeneratedAssetManifestEntry[];
};

afterEach(async () => {
	for (const tempDir of tempDirs) {
		await rm(tempDir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

async function readJsonFile<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function createModulePaths(projectSlug = "test-project"): Promise<{
	canonicalSpecPath: string;
	artifactRootDir: string;
	mediaOutputDir: string;
}> {
	const tempRoot = await createProjectTempDir(packageRoot, "deck-spec-module");
	tempDirs.push(tempRoot);

	return {
		canonicalSpecPath: path.join(
			tempRoot,
			projectSlug,
			"spec",
			"deck-spec.json",
		),
		artifactRootDir: path.join(tempRoot, "artifacts"),
		mediaOutputDir: path.join(
			tempRoot,
			projectSlug,
			"media",
			"generated-images",
		),
	};
}

function expectCanonicalShape(
	deckSpec: DeckSpec,
	status: "reviewed" | "media_ready",
): void {
	expect(deckSpec.spec_version).toBe("1.0.0");
	expect(deckSpec.status).toBe(status);
	expect(deckSpec.target_slide_count).toBe(deckSpec.slides.length);
	expect(
		validateDeckSpecDocument(deckSpec, deckSpecSchema as object, {
			projectDir: "/virtual/test-project",
		}).ok,
	).toBe(true);
}

function createReviewedDeckSpec(
	plan: DeckSpec,
	prompt: string,
	projectSlug = "test-project",
): DeckSpec {
	return normalizeSystemManagedFields(createPlanCandidateFromScenarioPlan(plan), {
		projectSlug,
		sourcePrompt: prompt,
		specStatus: "reviewed",
	});
}

function createMediaReadyDeckSpec(reviewedDeckSpec: DeckSpec): DeckSpec {
	return {
		...reviewedDeckSpec,
		status: "media_ready",
		asset_manifest: {
			...reviewedDeckSpec.asset_manifest,
			image_assets: reviewedDeckSpec.asset_manifest.image_assets.map((asset) => ({
				...asset,
				status: "generated",
			})),
			shared_assets: reviewedDeckSpec.asset_manifest.shared_assets.map((asset) => ({
				...asset,
				status: "generated",
			})),
		},
	};
}

function createGeneratedAssetsManifest(
	deckSpec: DeckSpec,
	mediaOutputDir: string,
): GeneratedAssetManifestEntry[] {
	return [
		...deckSpec.asset_manifest.image_assets.map((asset) => ({
			asset_id: asset.asset_id,
			asset_kind: "image" as const,
			output_file_name: asset.output_file_name,
			output_path: path.join(mediaOutputDir, asset.output_file_name),
			required: asset.required,
			exists: asset.status === "generated",
			status: asset.status,
		})),
		...deckSpec.asset_manifest.shared_assets.map((asset) => ({
			asset_id: asset.asset_id,
			asset_kind: "shared" as const,
			output_file_name: asset.output_file_name,
			output_path: path.join(mediaOutputDir, asset.output_file_name),
			required: asset.required,
			exists: asset.status === "generated",
			status: asset.status,
		})),
	];
}

function createSuccessfulPlanRun(input: {
	plan: DeckSpec;
	prompt: string;
	projectSlug?: string;
}): SuccessfulPlanDeckSpecRunResult {
	const projectSlug = input.projectSlug ?? "test-project";
	const plannedDeckSpec = normalizeSystemManagedFields(
		createPlanCandidateFromScenarioPlan(input.plan),
		{
			projectSlug,
			sourcePrompt: input.prompt,
		},
	);
	const reviewedDeckSpec = {
		...plannedDeckSpec,
		status: "reviewed" as const,
	};
	const review = createDeterministicSemanticReview(reviewedDeckSpec);
	const attemptDiagnostics: PlanningAttemptDiagnostics = {
		strategy: "primary" as const,
		stage: "semantic_review" as const,
		status: review.status === "fail" ? "failed" : "passed",
		summary: review.summary,
		review_status: review.status,
		missing_requirements: [...review.missing_requirements],
		drift_notes: [...review.drift_notes],
	};

	return {
		ok: true as const,
		deckSpec: reviewedDeckSpec,
		review,
		diagnostics: {
			used_fallback: false,
			attempts: [attemptDiagnostics],
		},
		attempts: [
			{
				strategy: "primary" as const,
				candidateDeckSpec: plannedDeckSpec,
				review,
				diagnostics: attemptDiagnostics,
			},
		],
	};
}

function createPlanningFailureRun(input: {
	code: "semantic_review_failed" | "contract_validation_failed" | "planning_failed";
	message: string;
}): FailedPlanDeckSpecRunResult {
	const diagnostics: DeckSpecPlanningDiagnostics = {
		used_fallback: false,
		attempts: [],
	};

	return {
		ok: false as const,
		error: new DeckSpecPlanningError({
			code: input.code,
			message: input.message,
			diagnostics,
		}),
		diagnostics,
		attempts: [],
	};
}

function createSuccessfulMediaResult(
	reviewedDeckSpec: DeckSpec,
	mediaOutputDir: string,
): MaterializeDeckSpecMediaResult {
	const mediaReadyDeckSpec = createMediaReadyDeckSpec(reviewedDeckSpec);
	const generatedAssetIds = [
		...mediaReadyDeckSpec.asset_manifest.image_assets.map((asset) => asset.asset_id),
		...mediaReadyDeckSpec.asset_manifest.shared_assets.map((asset) => asset.asset_id),
	];

	return {
		ok: true as const,
		deckSpec: mediaReadyDeckSpec,
		generatedAssetIds,
		unchangedAssetIds: [],
		failures: [],
		manifest: createGeneratedAssetsManifest(mediaReadyDeckSpec, mediaOutputDir),
	};
}

function createFailedMediaResult(
	reviewedDeckSpec: DeckSpec,
	mediaOutputDir: string,
): MaterializeDeckSpecMediaResult {
	const firstImageAsset = reviewedDeckSpec.asset_manifest.image_assets[0];
	const failedAsset =
		reviewedDeckSpec.asset_manifest.shared_assets[0] ??
		reviewedDeckSpec.asset_manifest.image_assets[1];
	if (!firstImageAsset || !failedAsset) {
		throw new Error("Expected fixture assets for the media-failure test.");
	}

	const partiallyGeneratedDeckSpec: DeckSpec = {
		...reviewedDeckSpec,
		status: "reviewed",
		asset_manifest: {
			...reviewedDeckSpec.asset_manifest,
			image_assets: reviewedDeckSpec.asset_manifest.image_assets.map((asset) => ({
				...asset,
				status: asset.asset_id === firstImageAsset.asset_id ? "generated" : asset.status,
			})),
			shared_assets: reviewedDeckSpec.asset_manifest.shared_assets.map((asset) => ({
				...asset,
				status: asset.asset_id === failedAsset.asset_id ? asset.status : asset.status,
			})),
		},
	};

	return {
		ok: false as const,
		deckSpec: partiallyGeneratedDeckSpec,
		generatedAssetIds: [firstImageAsset.asset_id],
		unchangedAssetIds: [],
		failures: [
			{
				asset_id: failedAsset.asset_id,
				message: "mock Gemini failure",
			},
		],
		manifest: createGeneratedAssetsManifest(
			partiallyGeneratedDeckSpec,
			mediaOutputDir,
		),
	};
}

describe("deck-spec-module public API", () => {
	it("writes a reviewed canonical deck spec plus artifacts for a no-media run", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const prompt =
			"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.";
		const tempPaths = await createModulePaths();
		const { mediaOutputDir: _unusedMediaOutputDir, ...paths } = tempPaths;
		const successfulPlanRun = createSuccessfulPlanRun({
			plan: baselinePlan,
			prompt,
		});
		const fakePlanDeckSpecRun = vi.fn<FakePlanDeckSpecRun>(
			async () => successfulPlanRun,
		);
		const fakeMaterializeDeckSpecMedia = vi.fn<FakeMaterializeDeckSpecMedia>();

		await runDeckSpecModule(
			{
				prompt,
				projectSlug: "test-project",
				apiKey: "test-key",
				paths,
				media: {
					enabled: false,
				},
			},
			{
				planDeckSpecRun: fakePlanDeckSpecRun,
				materializeDeckSpecMedia: fakeMaterializeDeckSpecMedia,
			},
		);

		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expect(fakePlanDeckSpecRun).toHaveBeenCalledTimes(1);
		expect(fakeMaterializeDeckSpecMedia).not.toHaveBeenCalled();
		expectCanonicalShape(deckSpec, "reviewed");
		expect(
			await readJsonFile<{ ok: boolean }>(
				resolveModuleResultPath(paths.artifactRootDir),
			),
		).toMatchObject({ ok: true });
		expect(
			await readJsonFile<DeckSpec>(
				resolveModulePrimaryCandidatePath(paths.artifactRootDir),
			),
		).toMatchObject({ status: "planned" });
		expect(
			await readJsonFile<null>(
				resolveModuleFallbackCandidatePath(paths.artifactRootDir),
			),
		).toBeNull();
		expect(
			await readJsonFile<{ status: string }>(
				resolveModuleReviewPath(paths.artifactRootDir),
			),
		).toMatchObject({ status: successfulPlanRun.review.status });
		expect(
			await readJsonFile<{ status: string; enabled: boolean }>(
				resolveModuleMediaResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			status: "skipped",
			enabled: false,
			final_spec_status: "reviewed",
		});
		expect(
			await readFile(resolveModuleReportPath(paths.artifactRootDir), "utf8"),
		).toContain("Deck-Spec Module Run");
		expect(
			await readJsonFile<{
				artifact_files: {
					candidate_primary: string;
					candidate_fallback: string;
					review_final: string;
				};
			}>(resolveModuleResultPath(paths.artifactRootDir)),
		).toMatchObject({
			artifact_files: {
				candidate_primary: resolveModulePrimaryCandidatePath(
					paths.artifactRootDir,
				),
				candidate_fallback: resolveModuleFallbackCandidatePath(
					paths.artifactRootDir,
				),
				review_final: resolveModuleReviewPath(paths.artifactRootDir),
			},
		});
	});

	it("writes media-ready canonical output and media artifacts when materialization succeeds", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const prompt =
			"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.";
		const paths = await createModulePaths();
		const successfulPlanRun = createSuccessfulPlanRun({
			plan: baselinePlan,
			prompt,
		});
		const fakePlanDeckSpecRun = vi.fn<FakePlanDeckSpecRun>(
			async () => successfulPlanRun,
		);
		const fakeMaterializeDeckSpecMedia = vi.fn<FakeMaterializeDeckSpecMedia>(
			async ({ deckSpec, mediaOutputDir }) =>
				createSuccessfulMediaResult(deckSpec, mediaOutputDir),
		);

		await runDeckSpecModule(
			{
				prompt,
				projectSlug: "test-project",
				apiKey: "test-key",
				paths,
			},
			{
				planDeckSpecRun: fakePlanDeckSpecRun,
				materializeDeckSpecMedia: fakeMaterializeDeckSpecMedia,
			},
		);

		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expect(fakeMaterializeDeckSpecMedia).toHaveBeenCalledWith({
			deckSpec: successfulPlanRun.deckSpec,
			mediaOutputDir: paths.mediaOutputDir,
			apiKey: "test-key",
		});
		expectCanonicalShape(deckSpec, "media_ready");
		expect(
			await readJsonFile<{ status: string; final_spec_status: string }>(
				resolveModuleMediaResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			status: "passed",
			final_spec_status: "media_ready",
		});
		expect(
			await readJsonFile<Array<{ exists: boolean }>>(
				resolveModuleGeneratedAssetsManifestPath(paths.artifactRootDir),
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					exists: true,
				}),
			]),
		);
	});

	it("keeps an existing canonical spec untouched when planning fails before publish", async () => {
		const paths = await createModulePaths();
		const existingCanonicalSpec = '{"sentinel":"keep-existing-prepublish-canonical"}\n';
		const fakePlanDeckSpecRun = vi.fn<FakePlanDeckSpecRun>(async () =>
			createPlanningFailureRun({
				code: "semantic_review_failed",
				message: "Mock planning failure before publish.",
			}),
		);
		const fakeMaterializeDeckSpecMedia = vi.fn<FakeMaterializeDeckSpecMedia>();

		await mkdir(path.dirname(paths.canonicalSpecPath), { recursive: true });
		await writeFile(paths.canonicalSpecPath, existingCanonicalSpec, "utf8");

		await expect(
			runDeckSpecModule(
				{
					prompt:
						"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
					projectSlug: "test-project",
					apiKey: "test-key",
					paths,
				},
				{
					planDeckSpecRun: fakePlanDeckSpecRun,
					materializeDeckSpecMedia: fakeMaterializeDeckSpecMedia,
				},
			),
		).rejects.toMatchObject({
			code: "semantic_review_failed",
		});

		expect(await readFile(paths.canonicalSpecPath, "utf8")).toBe(
			existingCanonicalSpec,
		);
		expect(fakeMaterializeDeckSpecMedia).not.toHaveBeenCalled();
		expect(
			await readJsonFile<{ ok: boolean; failure?: { code: string } }>(
				resolveModuleResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			ok: false,
			failure: {
				code: "semantic_review_failed",
			},
		});
		expect(
			await readJsonFile<null>(
				resolveModulePrimaryCandidatePath(paths.artifactRootDir),
			),
		).toBeNull();
		expect(
			await readJsonFile<null>(
				resolveModuleFallbackCandidatePath(paths.artifactRootDir),
			),
		).toBeNull();
		expect(
			await readJsonFile<null>(resolveModuleReviewPath(paths.artifactRootDir)),
		).toBeNull();
	});

	it("keeps the canonical spec published at reviewed when later media generation fails", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const prompt =
			"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.";
		const paths = await createModulePaths();
		const successfulPlanRun = createSuccessfulPlanRun({
			plan: baselinePlan,
			prompt,
		});

		await expect(
			runDeckSpecModule(
				{
					prompt,
					projectSlug: "test-project",
					apiKey: "test-key",
					paths,
				},
				{
					planDeckSpecRun: async () => successfulPlanRun,
					materializeDeckSpecMedia: async ({ deckSpec, mediaOutputDir }) =>
						createFailedMediaResult(deckSpec, mediaOutputDir),
				},
			),
		).rejects.toMatchObject({
			code: "media_generation_failed",
		});

		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expectCanonicalShape(deckSpec, "reviewed");
		expect(
			deckSpec.asset_manifest.image_assets.some(
				(asset) => asset.status === "generated",
			),
		).toBe(true);
		expect(
			await readJsonFile<{ ok: boolean; failure?: { code: string } }>(
				resolveModuleResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			ok: false,
			failure: {
				code: "media_generation_failed",
			},
		});
		expect(
			await readJsonFile<Array<{ asset_id: string; message: string }>>(
				resolveModuleMediaFailuresPath(paths.artifactRootDir),
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					asset_id: expect.any(String),
					message: "mock Gemini failure",
				}),
			]),
		);
	});

	it("recovers to media_ready when rerun after a partial media failure on the same publish paths", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const prompt =
			"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.";
		const paths = await createModulePaths();
		const successfulPlanRun = createSuccessfulPlanRun({
			plan: baselinePlan,
			prompt,
		});
		let shouldFail = true;

		await expect(
			runDeckSpecModule(
				{
					prompt,
					projectSlug: "test-project",
					apiKey: "test-key",
					paths,
				},
				{
					planDeckSpecRun: async () => successfulPlanRun,
					materializeDeckSpecMedia: async ({ deckSpec, mediaOutputDir }) => {
						if (shouldFail) {
							shouldFail = false;
							return createFailedMediaResult(deckSpec, mediaOutputDir);
						}

						return createSuccessfulMediaResult(deckSpec, mediaOutputDir);
					},
				},
			),
		).rejects.toMatchObject({
			code: "media_generation_failed",
		});

		const reviewedDeckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expectCanonicalShape(reviewedDeckSpec, "reviewed");

		await runDeckSpecModule(
			{
				prompt,
				projectSlug: "test-project",
				apiKey: "test-key",
				paths,
			},
			{
				planDeckSpecRun: async () => successfulPlanRun,
				materializeDeckSpecMedia: async ({ deckSpec, mediaOutputDir }) =>
					createSuccessfulMediaResult(deckSpec, mediaOutputDir),
			},
		);

		const recoveredDeckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expectCanonicalShape(recoveredDeckSpec, "media_ready");
		expect(
			await readJsonFile<{ ok: boolean }>(
				resolveModuleResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			ok: true,
		});
	});

	it("rejects package-internal output paths before planning starts", async () => {
		const fakePlanDeckSpecRun = vi.fn<FakePlanDeckSpecRun>();

		await expect(
			runDeckSpecModule(
				{
					prompt:
						"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
					projectSlug: "test-project",
					apiKey: "test-key",
					paths: {
						canonicalSpecPath: path.join(
							packageRoot,
							"tmp",
							"forbidden",
							"deck-spec.json",
						),
						artifactRootDir: path.join(packageRoot, "tmp", "forbidden-artifacts"),
						mediaOutputDir: path.join(packageRoot, "tmp", "forbidden-media"),
					},
				},
				{
					planDeckSpecRun: fakePlanDeckSpecRun,
				},
			),
		).rejects.toMatchObject({
			code: "planning_failed",
			message:
				"canonicalSpecPath must be outside the deck-spec-module package directory.",
		});

		expect(fakePlanDeckSpecRun).not.toHaveBeenCalled();
	});

	it("does not overwrite an existing canonical spec when the publish step cannot write atomically", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const prompt =
			"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.";
		const paths = await createModulePaths();
		const specDir = path.dirname(paths.canonicalSpecPath);
		const previousCanonicalSpec = '{"sentinel":"keep-existing-canonical-spec"}\n';

		await mkdir(specDir, { recursive: true });
		await writeFile(paths.canonicalSpecPath, previousCanonicalSpec, "utf8");
		await chmod(specDir, 0o555);

		try {
			await expect(
				runDeckSpecModule(
					{
						prompt,
						projectSlug: "test-project",
						apiKey: "test-key",
						paths,
						media: {
							enabled: false,
						},
					},
					{
						planDeckSpecRun: async () =>
							createSuccessfulPlanRun({
								plan: baselinePlan,
								prompt,
							}),
					},
				),
			).rejects.toBeInstanceOf(Error);
		} finally {
			await chmod(specDir, 0o755);
		}

		expect(await readFile(paths.canonicalSpecPath, "utf8")).toBe(
			previousCanonicalSpec,
		);
	});
});
