import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import deckSpecSchema from "../spec/deck-spec.schema.json" with {
	type: "json",
};
import { generateDeckSpecCandidateWithGemini } from "../src/deck-spec-module/planning/geminiPlannerModel.js";
import { generateImageWithGemini } from "../src/deck-spec-module/media/geminiImageProvider.js";
import { buildInitialPlannerPrompt } from "../src/deck-spec-module/planning/plannerPrompt.js";
import {
	runDeckSpecModule,
} from "../src/public-api.js";
import type { DeckSpec, DeckSpecCandidate } from "../src/spec/contract.js";
import {
	resolveModuleDiagnosticsPath,
	resolveModuleGeneratedAssetsManifestPath,
	resolveModuleMediaFailuresPath,
	resolveModuleMediaResultPath,
	resolveModulePrimaryCandidatePath,
	resolveModuleReportPath,
	resolveModuleResultPath,
} from "../src/spec/readDeckSpec.js";
import { validateDeckSpecDocument } from "../src/spec/validateDeckSpec.js";
import {
	createPlanCandidateFromScenarioPlan,
	loadDeckSpecBaselinePlan,
} from "./deckSpecScenarioFixtures.js";
import { createProjectTempDir } from "./testTempDir.js";

vi.mock("../src/deck-spec-module/planning/geminiPlannerModel.js", () => ({
	generateDeckSpecCandidateWithGemini: vi.fn(),
}));
vi.mock("../src/deck-spec-module/media/geminiImageProvider.js", () => ({
	generateImageWithGemini: vi.fn(),
}));

const mockedGenerateDeckSpecCandidateWithGemini = vi.mocked(
	generateDeckSpecCandidateWithGemini,
);
const mockedGenerateImageWithGemini = vi.mocked(generateImageWithGemini);
const tempDirs: string[] = [];
const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

afterEach(async () => {
	vi.resetAllMocks();
	for (const tempDir of tempDirs) {
		await rm(tempDir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

function cloneCandidate(candidate: DeckSpecCandidate): DeckSpecCandidate {
	return structuredClone(candidate);
}

function expectReviewedCanonicalShape(deckSpec: DeckSpec): void {
	expect(deckSpec.spec_version).toBe("1.0.0");
	expect(deckSpec.status).toBe("reviewed");
	expect(deckSpec.target_slide_count).toBe(deckSpec.slides.length);
	expect(deckSpec.asset_manifest.text_assets.length).toBeGreaterThan(0);
	expect(deckSpec.asset_manifest.image_assets.length).toBeGreaterThan(0);
	expect(
		validateDeckSpecDocument(deckSpec, deckSpecSchema as object, {
			projectDir: "/virtual/test-project",
		}).ok,
	).toBe(true);
}

function expectMediaReadyCanonicalShape(deckSpec: DeckSpec): void {
	expect(deckSpec.spec_version).toBe("1.0.0");
	expect(deckSpec.status).toBe("media_ready");
	expect(deckSpec.target_slide_count).toBe(deckSpec.slides.length);
	expect(
		validateDeckSpecDocument(deckSpec, deckSpecSchema as object, {
			projectDir: "/virtual/test-project",
		}).ok,
	).toBe(true);
}

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

async function createMockImageBuffer(background: {
	r: number;
	g: number;
	b: number;
}): Promise<Buffer> {
	return sharp({
		create: {
			width: 96,
			height: 96,
			channels: 4,
			background: {
				...background,
				alpha: 1,
			},
		},
	})
		.png()
		.toBuffer();
}

function createAudienceFramingCandidate(plan: DeckSpec): DeckSpecCandidate {
	const repairedPlan = structuredClone(plan);
	repairedPlan.slides.unshift({
		slide_id: "audience_framing",
		title: "Audience Framing",
		objectives: [
			"Clarify who this deck is for before the implementation sequence begins.",
			"Frame the material for operators and reviewers.",
		],
		layout_intent: "hero",
		content_blocks: [
			{
				block_id: "audience_badge_block",
				block_type: "badge",
				layout_slot: "eyebrow_badge",
				text_asset_id: "audience_badge",
			},
			{
				block_id: "audience_message_block",
				block_type: "text",
				layout_slot: "hero_message",
				text_asset_id: "audience_message",
			},
			{
				block_id: "audience_visual_block",
				block_type: "image",
				layout_slot: "hero_visual",
				image_asset_id: "audience_visual_asset",
			},
		],
		status: "planned",
	});
	repairedPlan.asset_manifest.text_assets.push(
		{
			asset_id: "audience_badge",
			asset_label: "Audience badge",
			text_kind: "plain_text",
			content: "Audience first",
			required: true,
			status: "planned",
		},
		{
			asset_id: "audience_message",
			asset_label: "Audience message",
			text_kind: "plain_text",
			content:
				"This deck is for operators who need the planning contract explained before the execution sequence begins.",
			required: true,
			status: "planned",
		},
	);
	repairedPlan.asset_manifest.image_assets.push({
		asset_id: "audience_visual_asset",
		asset_label: "Audience framing visual",
		slide_id: "audience_framing",
		intended_usage: "hero_visual",
		size_tier: "large",
		style: "editorial presentation illustration",
		subject:
			"operators and reviewers aligning on the deck contract before workflow execution",
		aspect_ratio: "16:9",
		image_prompt_spec: {
			composition:
				"Use a clear focal point that shows the intended audience aligning around a planning contract before execution details.",
			color_direction:
				"Use restrained corporate blues with warm neutral highlights and teal accents.",
			detail_cues: [
				"clear human focal point",
				"presentation-ready simplicity",
				"structured meeting context",
			],
			avoid_elements: ["logos", "tiny unreadable text", "UI chrome"],
		},
		output_format: "png",
		required: true,
		output_file_name: "audience_framing__hero_visual__large.png",
		status: "planned",
	});
	repairedPlan.slide_mapping.unshift({
		slide_id: "audience_framing",
		text_asset_ids: ["audience_badge", "audience_message"],
		image_asset_ids: ["audience_visual_asset"],
		shared_asset_ids: [],
	});
	repairedPlan.target_slide_count = repairedPlan.slides.length;

	return createPlanCandidateFromScenarioPlan(repairedPlan);
}

function createContractDriftCandidate(plan: DeckSpec): DeckSpecCandidate {
	const driftedCandidate = createPlanCandidateFromScenarioPlan(plan);
	const firstImageAsset = driftedCandidate.asset_manifest.image_assets[0] as
		| (typeof driftedCandidate.asset_manifest.image_assets)[number]
		| undefined;
	if (firstImageAsset) {
		delete (firstImageAsset as { image_prompt_spec?: unknown })
			.image_prompt_spec;
	}
	return driftedCandidate;
}

describe("deck-spec-module public API", () => {
	it("includes a canonical JSON example in the planner prompt so model output stays on-contract", () => {
		const prompt = buildInitialPlannerPrompt(
			"Create a six-slide deck about canonical spec planning.",
		);

		expect(prompt).toContain("## Canonical JSON Shape Example");
		expect(prompt).toContain('"block_type": "badge"');
		expect(prompt).toContain('"text_kind": "plain_text"');
		expect(prompt).toContain('"image_prompt_spec"');
		expect(prompt).toContain('"shared_assets": []');
		expect(prompt).toContain("Do not use generic aliases");
	});

	it("writes a reviewed canonical deck spec plus artifacts when the planner model yields a valid candidate", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const paths = await createModulePaths();
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);

		await runDeckSpecModule({
			prompt:
				"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
			media: {
				enabled: false,
			},
		});
		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);

		expect(mockedGenerateDeckSpecCandidateWithGemini).toHaveBeenCalledTimes(1);
		expectReviewedCanonicalShape(deckSpec);
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
			await readFile(resolveModuleReportPath(paths.artifactRootDir), "utf8"),
		).toContain("Deck-Spec Module Run");
	});

	it("materializes generated media into caller-owned output paths during the default spec run", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const paths = await createModulePaths();
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);
		mockedGenerateImageWithGemini.mockImplementation(async () => ({
			imageBytes: await createMockImageBuffer({
				r: 40,
				g: 96,
				b: 152,
			}),
			mimeType: "image/png",
			model: "mock-gemini-image",
		}));

		await runDeckSpecModule({
			prompt:
				"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
		});
		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);

		expect(mockedGenerateImageWithGemini).toHaveBeenCalledTimes(
			baselinePlan.asset_manifest.image_assets.length +
				baselinePlan.asset_manifest.shared_assets.length,
		);
		expectMediaReadyCanonicalShape(deckSpec);
		expect(
			deckSpec.asset_manifest.image_assets.every(
				(asset) => asset.status === "generated",
			),
		).toBe(true);
		expect(
			deckSpec.asset_manifest.shared_assets.every(
				(asset) => asset.status === "generated",
			),
		).toBe(true);
		expect(
			await readJsonFile<{ status: string }>(
				resolveModuleMediaResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			status: "passed",
			final_spec_status: "media_ready",
		});
		expect(
			await readJsonFile<Array<{ asset_id: string; exists: boolean }>>(
				resolveModuleGeneratedAssetsManifestPath(paths.artifactRootDir),
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					asset_id: baselinePlan.asset_manifest.image_assets[0]?.asset_id,
					exists: true,
				}),
			]),
		);
	});

	it("supports no-media runs without requiring a media output path", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);

		const tempPaths = await createModulePaths();
		const { mediaOutputDir: _unusedMediaOutputDir, ...paths } = tempPaths;

		await runDeckSpecModule({
			prompt:
				"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
			media: {
				enabled: false,
			},
		});
		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);

		expect(mockedGenerateImageWithGemini).not.toHaveBeenCalled();
		expectReviewedCanonicalShape(deckSpec);
		expect(
			await readJsonFile<{ status: string; enabled: boolean }>(
				resolveModuleMediaResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			status: "skipped",
			enabled: false,
			final_spec_status: "reviewed",
		});
	});

	it("promotes reviewed specs with no required images directly to media_ready", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const noRequiredMediaPlan = structuredClone(baselinePlan);
		noRequiredMediaPlan.asset_manifest.image_assets =
			noRequiredMediaPlan.asset_manifest.image_assets.map((asset) => ({
				...asset,
				required: false,
			}));
		noRequiredMediaPlan.asset_manifest.shared_assets =
			noRequiredMediaPlan.asset_manifest.shared_assets.map((asset) => ({
				...asset,
				required: false,
			}));
		const paths = await createModulePaths();
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(noRequiredMediaPlan),
		);

		await runDeckSpecModule({
			prompt:
				"Create a six-slide deck about canonical spec planning without required generated visuals.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
		});
		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);

		expect(mockedGenerateImageWithGemini).not.toHaveBeenCalled();
		expectMediaReadyCanonicalShape(deckSpec);
	});

	it("uses one internal repair attempt when the first candidate fails semantic review", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const paths = await createModulePaths();
		mockedGenerateDeckSpecCandidateWithGemini
			.mockResolvedValueOnce(createPlanCandidateFromScenarioPlan(baselinePlan))
			.mockResolvedValueOnce(createAudienceFramingCandidate(baselinePlan));

		await runDeckSpecModule({
			prompt:
				"Create a six-slide deck for operators that explicitly includes an audience framing slide before the workflow detail.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
			media: {
				enabled: false,
			},
		});
		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);

		expect(mockedGenerateDeckSpecCandidateWithGemini).toHaveBeenCalledTimes(2);
		expect(deckSpec.slides[0]?.slide_id).toBe("audience_framing");
		expectReviewedCanonicalShape(deckSpec);
		expect(
			await readJsonFile<{ used_fallback: boolean }>(
				resolveModuleDiagnosticsPath(paths.artifactRootDir),
			),
		).toMatchObject({ used_fallback: true });
	});

	it("throws semantic_review_failed when the repair attempt still does not satisfy eval", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		mockedGenerateDeckSpecCandidateWithGemini
			.mockResolvedValueOnce(
				cloneCandidate(createPlanCandidateFromScenarioPlan(baselinePlan)),
			)
			.mockResolvedValueOnce(
				cloneCandidate(createPlanCandidateFromScenarioPlan(baselinePlan)),
			);

		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck for operators that explicitly includes two audience framing slides before the workflow detail.",
				projectSlug: "test-project",
				apiKey: "test-key",
				paths: await createModulePaths(),
			}),
		).rejects.toMatchObject({
			code: "semantic_review_failed",
			diagnostics: {
				used_fallback: true,
			},
		});
	});

	it("throws contract_validation_failed instead of crashing when malformed model output misses required nested fields", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const malformedCandidate = createContractDriftCandidate(baselinePlan);
		mockedGenerateDeckSpecCandidateWithGemini
			.mockResolvedValueOnce(structuredClone(malformedCandidate))
			.mockResolvedValueOnce(structuredClone(malformedCandidate));

		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck about canonical spec planning with strict image prompt requirements.",
				projectSlug: "test-project",
				apiKey: "test-key",
				paths: await createModulePaths(),
			}),
		).rejects.toMatchObject({
			code: "contract_validation_failed",
			diagnostics: {
				used_fallback: true,
				attempts: [
					expect.objectContaining({
						stage: "validation",
						status: "failed",
					}),
					expect.objectContaining({
						stage: "validation",
						status: "failed",
					}),
				],
			},
		});
	});

	it("throws prompt_invalid for underspecified prompts", async () => {
		await expect(
			runDeckSpecModule({
				prompt: "Too short",
				projectSlug: "test-project",
				apiKey: "test-key",
				paths: await createModulePaths(),
			}),
		).rejects.toMatchObject({
			code: "prompt_invalid",
		});
	});

	it("keeps the canonical spec published at reviewed when later media generation fails", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const paths = await createModulePaths();
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);
		mockedGenerateImageWithGemini.mockImplementation(async (request) => {
			if (request.prompt.includes("Stable build visual")) {
				throw new Error("mock Gemini failure");
			}

			return {
				imageBytes: await createMockImageBuffer({
					r: 64,
					g: 96,
					b: 144,
				}),
				mimeType: "image/png",
				model: "mock-gemini-image",
			};
		});

		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
				projectSlug: "test-project",
				apiKey: "test-key",
				paths,
			}),
		).rejects.toMatchObject({
			code: "media_generation_failed",
		});

		const deckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expect(deckSpec.status).toBe("reviewed");
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
		const paths = await createModulePaths();
		let shouldFailOneStableBuildVisual = true;
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);
		mockedGenerateImageWithGemini.mockImplementation(async (request) => {
			if (
				shouldFailOneStableBuildVisual &&
				request.prompt.includes("Stable build visual")
			) {
				shouldFailOneStableBuildVisual = false;
				throw new Error("mock Gemini failure");
			}

			return {
				imageBytes: await createMockImageBuffer({
					r: 48,
					g: 104,
					b: 160,
				}),
				mimeType: "image/png",
				model: "mock-gemini-image",
			};
		});

		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
				projectSlug: "test-project",
				apiKey: "test-key",
				paths,
			}),
		).rejects.toMatchObject({
			code: "media_generation_failed",
		});

		const reviewedDeckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expectReviewedCanonicalShape(reviewedDeckSpec);
		expect(
			reviewedDeckSpec.asset_manifest.image_assets.some(
				(asset) => asset.status === "generated",
			),
		).toBe(true);

		await runDeckSpecModule({
			prompt:
				"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
		});

		const recoveredDeckSpec = await readJsonFile<DeckSpec>(paths.canonicalSpecPath);
		expectMediaReadyCanonicalShape(recoveredDeckSpec);
		expect(
			recoveredDeckSpec.asset_manifest.image_assets.every(
				(asset) => asset.status === "generated",
			),
		).toBe(true);
		expect(
			recoveredDeckSpec.asset_manifest.shared_assets.every(
				(asset) => asset.status === "generated",
			),
		).toBe(true);
		expect(
			await readJsonFile<{ ok: boolean }>(
				resolveModuleResultPath(paths.artifactRootDir),
			),
		).toMatchObject({
			ok: true,
		});
		expect(
			await readJsonFile<Array<{ required: boolean; exists: boolean }>>(
				resolveModuleGeneratedAssetsManifestPath(paths.artifactRootDir),
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					required: true,
					exists: true,
				}),
			]),
		);
	});

	it("rejects package-internal output paths before planning starts", async () => {
		await expect(
			runDeckSpecModule({
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
					artifactRootDir: path.join(
						packageRoot,
						"tmp",
						"forbidden-artifacts",
					),
					mediaOutputDir: path.join(
						packageRoot,
						"tmp",
						"forbidden-media",
					),
				},
			}),
		).rejects.toMatchObject({
			code: "planning_failed",
			message:
				"canonicalSpecPath must be outside the deck-spec-module package directory.",
		});
		expect(mockedGenerateDeckSpecCandidateWithGemini).not.toHaveBeenCalled();
	});

	it("does not overwrite an existing canonical spec when the final publish step cannot write atomically", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const paths = await createModulePaths();
		const specDir = path.dirname(paths.canonicalSpecPath);
		const previousCanonicalSpec = '{"sentinel":"keep-existing-canonical-spec"}\n';
		mockedGenerateDeckSpecCandidateWithGemini.mockResolvedValue(
			createPlanCandidateFromScenarioPlan(baselinePlan),
		);

		await mkdir(specDir, { recursive: true });
		await writeFile(paths.canonicalSpecPath, previousCanonicalSpec, "utf8");
		await chmod(specDir, 0o555);

		try {
			await expect(
				runDeckSpecModule({
					prompt:
						"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
					projectSlug: "test-project",
					apiKey: "test-key",
					paths,
				}),
			).rejects.toBeInstanceOf(Error);
		} finally {
			await chmod(specDir, 0o755);
		}

		expect(await readFile(paths.canonicalSpecPath, "utf8")).toBe(
			previousCanonicalSpec,
		);
	});

	it("keeps an existing canonical spec untouched when semantic review fails before publish", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const paths = await createModulePaths();
		const existingCanonicalSpec = '{"sentinel":"keep-existing-prepublish-canonical"}\n';
		mockedGenerateDeckSpecCandidateWithGemini
			.mockResolvedValueOnce(
				cloneCandidate(createPlanCandidateFromScenarioPlan(baselinePlan)),
			)
			.mockResolvedValueOnce(
				cloneCandidate(createPlanCandidateFromScenarioPlan(baselinePlan)),
			);

		await mkdir(path.dirname(paths.canonicalSpecPath), { recursive: true });
		await writeFile(paths.canonicalSpecPath, existingCanonicalSpec, "utf8");

		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck for operators that explicitly includes two audience framing slides before the workflow detail.",
				projectSlug: "test-project",
				apiKey: "test-key",
				paths,
			}),
		).rejects.toMatchObject({
			code: "semantic_review_failed",
		});

		expect(await readFile(paths.canonicalSpecPath, "utf8")).toBe(
			existingCanonicalSpec,
		);
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
	});

	it("keeps failure diagnostics path-free in both the thrown error and diagnostics artifact", async () => {
		const baselinePlan = await loadDeckSpecBaselinePlan();
		const malformedCandidate = createContractDriftCandidate(baselinePlan);
		const paths = await createModulePaths();
		mockedGenerateDeckSpecCandidateWithGemini
			.mockResolvedValueOnce(structuredClone(malformedCandidate))
			.mockResolvedValueOnce(structuredClone(malformedCandidate));

		const error = await runDeckSpecModule({
			prompt:
				"Create a six-slide deck about canonical spec planning with strict image prompt requirements.",
			projectSlug: "test-project",
			apiKey: "test-key",
			paths,
		}).catch((failure: unknown) => failure);

		expect(error).toMatchObject({
			code: "contract_validation_failed",
		});
		const errorDiagnosticsJson = JSON.stringify(
			(error as { diagnostics: unknown }).diagnostics,
		);
		const artifactDiagnosticsJson = JSON.stringify(
			await readJsonFile(resolveModuleDiagnosticsPath(paths.artifactRootDir)),
		);

		expect(errorDiagnosticsJson).not.toContain(paths.canonicalSpecPath);
		expect(errorDiagnosticsJson).not.toContain(paths.artifactRootDir);
		expect(artifactDiagnosticsJson).not.toContain(paths.canonicalSpecPath);
		expect(artifactDiagnosticsJson).not.toContain(paths.artifactRootDir);
	});

	it("requires explicit apiKey and projectSlug instead of reading shell state", async () => {
		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
				projectSlug: "",
				apiKey: "test-key",
				paths: await createModulePaths(""),
			}),
		).rejects.toMatchObject({
			code: "planning_failed",
			message: "Missing projectSlug. Pass projectSlug in options.",
		});

		await expect(
			runDeckSpecModule({
				prompt:
					"Create a six-slide deck about canonical spec planning, semantic review, media generation, and deterministic build delivery.",
				projectSlug: "test-project",
				apiKey: "",
				paths: await createModulePaths(),
			}),
		).rejects.toMatchObject({
			code: "planning_failed",
			message: "Missing GEMINI_API_KEY. Pass apiKey in options.",
		});
	});
});
