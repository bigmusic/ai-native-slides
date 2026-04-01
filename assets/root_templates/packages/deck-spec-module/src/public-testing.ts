export type {
	PlanDeckSpecRunDependencies,
	PlanDeckSpecRunOptions,
	PlanDeckSpecRunResult,
	PlanningAttemptArtifact,
} from "./deck-spec-module/canonicalization/finalizeDeckSpec.js";
export { planDeckSpecRun } from "./deck-spec-module/canonicalization/finalizeDeckSpec.js";
export { buildInitialPlannerPrompt } from "./deck-spec-module/planning/plannerPrompt.js";
export {
	DEFAULT_GEMINI_PLANNER_MODEL,
	DEFAULT_GEMINI_PLANNER_SYSTEM_INSTRUCTION,
	generateDeckSpecCandidateWithGemini,
} from "./deck-spec-module/planning/geminiPlannerModel.js";
export {
	DEFAULT_GEMINI_PROVIDER_RETRY_ATTEMPTS,
	DEFAULT_GEMINI_PROVIDER_TIMEOUT_MS,
	createGeminiHttpOptions,
} from "./deck-spec-module/providerRequestConfig.js";

export { createDeterministicSemanticReview } from "./deck-spec-module/review-bridge/createSemanticReview.js";
export type {
	MaterialQualitySignal,
	MaterialQualitySignalId,
	MaterialQualitySignalSeverity,
} from "./deck-spec-module/reviewing/materialQuality.js";
export {
	collectMaterialQualitySignals,
	collectPlaceholderTextAssetIds,
	collectUnderdevelopedTextAssetIds,
	hasPlaceholderText,
	materialQualitySignalIds,
	materialQualitySignalSeverityValues,
	plannerMaterialAuthoringRules,
	reviewMaterialGuidance,
} from "./deck-spec-module/reviewing/materialQuality.js";
export type {
	PlannedImageAsset,
	PromptQualitySignal,
	PromptQualitySignalId,
	PromptQualitySignalSeverity,
	ReviewVisualPromptSummary,
} from "./deck-spec-module/reviewing/promptQuality.js";
export {
	classifyPromptQualitySignals,
	collectPromptQualitySignals,
	createReviewVisualPromptSummaries,
	plannerPromptAuthoringRules,
	promptQualitySignalIds,
	promptQualitySignalSeverityValues,
	reviewPromptGuidance,
} from "./deck-spec-module/reviewing/promptQuality.js";
export type { ScoreDimensionSpec } from "./deck-spec-module/reviewing/scorecard.js";
export {
	calculateOverallAverage,
	calculateSectionAverage,
	deckMaterialScoreDimensionSpecs,
	imagePromptScoreDimensionSpecs,
	roundScoreAverage,
} from "./deck-spec-module/reviewing/scorecard.js";

export type {
	AssetFailure,
	DeckSpecMediaPhaseArtifacts,
	GeneratedAssetManifestEntry,
	MediaPhaseStatus,
} from "./deck-spec-module/media/materializeDeckSpecMedia.js";
export {
	createNotStartedMediaArtifacts,
	createSkippedMediaArtifacts,
	materializeDeckSpecMedia,
} from "./deck-spec-module/media/materializeDeckSpecMedia.js";
export type { GeminiApiKeyResolution } from "./deck-spec-module/media/providerEnv.js";
export {
	GEMINI_API_KEY_ENV_NAME,
	parseDotEnv,
	resolveGeminiApiKey,
} from "./deck-spec-module/media/providerEnv.js";
export {
	DEFAULT_GEMINI_IMAGE_MODEL,
	generateImageWithGemini,
} from "./deck-spec-module/media/geminiImageProvider.js";
export type {
	NormalizeGeneratedImageInput,
	ResizeStrategy,
	TargetDimensions,
} from "./deck-spec-module/media/imagePolicy.js";
export {
	normalizeGeneratedImage,
	resolvePaddingColor,
	resolveResizeStrategy,
	resolveTargetDimensions,
} from "./deck-spec-module/media/imagePolicy.js";
