# skills-test plan

## Goal

slide-deck workflow with a shared-runtime model:

- one shared deck root runtime
- one `projects/<slug>/` directory per deck project
- project directories keep only project content, metadata, wrappers, and outputs
- build/test/validate commands run from the project directory but use the root `node_modules/` and root `.venv/`

## Scope

- This plan records the currently decided shared-root workflow, prompt-routing basis, current validation status, and the short-term implementation plan that stays within this workflow.
- The user-facing workflow basis is `FLOW.md`, with operator prompt guidance in `README.md` and supporting detail in `references/project-workflow.md`.
- Maintainer-only operations are not documented here; they live in `scripts/maintenance/maintenance-workflow.md`.

## Current Decisions

- The shared-root model is the current design:
  - one deck root runtime
  - one `projects/<slug>/` per deck project
- The current workspace is split into:
  - skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
  - demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
  - demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Reusable workflow and scaffold changes should be developed and validated in the demo project first, then synced back into the skill repo templates, scripts, and docs.
- Project-local wrappers remain the current stable interface.
  - Users run `pnpm spec:generate`, `pnpm spec`, `pnpm spec:validate`, `pnpm spec:review`, `pnpm media`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate` from the project directory
  - The project still uses the shared root `node_modules/` and root `.venv/`
- `pnpm media` is the only Gemini-dependent command in v1.
  - It reads `GEMINI_API_KEY` from the current shell or from `<deck-root>/.env`
  - It writes canonical generated files to `media/generated-images/`
  - It updates required image/shared asset status in `spec/deck-spec.json`
- Skill-agent responsibilities in v1 include spec-candidate authoring, semantic-review candidate authoring, candidate-only retry after retryable `pnpm spec` failures, deck authoring, and command orchestration.
- The intended operator experience is one skill-agent-owned end-to-end session per user prompt.
  - That same session starts by routing the prompt to either `new_project` or `revise_existing_project`, then owns planning, semantic review, candidate retry, deck authoring, media generation orchestration, and deliverable production for that target project.
  - If the prompt is revision feedback for an existing deck, the skill reruns that project's end-to-end workflow instead of manually patching intermediate candidate files.
  - If the prompt clearly asks for a new deck, the skill initializes or refreshes the requested `projects/<slug>/` scaffold first, then runs the same end-to-end workflow there.
  - Active project identity comes from explicit prompt wording first and current project metadata second, including `.ai-native-slides/project.json` and `.ai-native-slides/state.json` when the session is already scoped to one project.
- Post-deliverable review feedback is outside the tracked workflow phases.
  - When revision feedback arrives, it should be expressed as a new prompt that names the target project or clearly asks for a new one.
- Gemini responsibilities in v1 are limited to image generation during `pnpm media`; Gemini does not own planning, review, deck composition, or validation.
- User-facing entrypoints are limited to:
  - `scripts/init_deck_root.sh`
  - `scripts/init_deck_project.sh`
  - `scripts/ensure_deck_root.sh`
  - `scripts/ensure_deck_project.sh`
- Maintainer-only entrypoints are grouped under `scripts/maintenance/`:
  - `repair_deck_project.sh`
  - `clean_deck_project.sh`
  - `migrate_single_workspace_to_project.sh`
  - `sync_to_codex.sh`
- `init_deck_project.sh` only creates or refreshes the project scaffold; it does not generate deck content.
- `src/buildDeck.ts`, `src/presentationModel.ts`, and `tests/buildDeck.test.ts` are prompt-generated project content.
- In Codex, LibreOffice-backed validation is treated as human-in-the-loop and should be rerun in a local terminal when needed.

## Project Dir Scaffold Boundary

Template-managed files:

- `.gitignore`
- `spec/deck-spec.schema.json`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `run-project.sh`
- `validate-local.sh`
- `src/main.ts`
- `src/asset-pipeline/generateMedia.ts`
- `src/asset-pipeline/imagePolicy.ts`
- `src/asset-pipeline/paths.ts`
- `src/planner-agent/image-generation/env.ts`
- `src/planner-agent/image-generation/geminiAdapter.ts`
- `src/planner-agent/material-quality.ts`
- `src/planner-agent/planner-brief.ts`
- `src/planner-agent/planner-input.ts`
- `src/planner-agent/planner-output.ts`
- `src/planner-agent/prompt-quality.ts`
- `src/planner-agent/review-brief.ts`
- `src/planner-agent/scorecard.ts`
- `src/spec/contract.ts`
- `src/spec/deriveOutputFileName.ts`
- `src/spec/generatePlannerBrief.ts`
- `src/spec/normalizeSystemManagedFields.ts`
- `src/spec/plannerContext.ts`
- `src/spec/promoteDeckSpecCandidate.ts`
- `src/spec/promoteSpecReviewCandidate.ts`
- `src/spec/readDeckSpec.ts`
- `src/spec/reviewContext.ts`
- `src/spec/rendererContract.ts`
- `src/spec/renderSpecReview.ts`
- `src/spec/reviewContract.ts`
- `src/spec/validateDeckSpec.ts`
- `src/spec/validateSpecReview.ts`
- `src/spec/writeFileAtomic.ts`

Prompt-generated project content:

- `spec/deck-spec.json`
- `src/buildDeck.ts`
- `src/presentationModel.ts`
- `tests/buildDeck.test.ts`

Project-owned content dirs:

- `media/`
- `spec/`
- `src/`
- `tests/`
- `output/`
- `tmp/`

## Current Validation Workspace

- Deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Validation project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Current build output: `output/ai-native-product-deck.pptx`

## Verified Behavior

- `pnpm spec:validate`
- `pnpm spec:generate`
- `pnpm media`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Deterministic planner-agent regression now covers fixture-backed prompt/material drift scenarios plus one full `spec:generate -> spec -> spec:review` integration path.
- `vitest` cache is redirected to project-local `tmp/.vite`
- Re-running `init_deck_project.sh` preserves existing prompt-generated content instead of overwriting it
- `scripts/bootstrap_deck_project.sh` and `scripts/ensure_deck_project.sh --json` recognize the scaffold-managed `spec` / `spec:review` / `media` modules and scripts in the example project
- `pnpm media` reads `GEMINI_API_KEY` from the current shell or `<deck-root>/.env`, writes deck-ready files into `media/generated-images/`, and updates canonical image asset status to `generated`

Expected in Codex:

- The same skill-owned session begins by classifying the prompt as `new_project` or `revise_existing_project` and resolving the target project from explicit prompt wording plus local project metadata when available
- `pnpm spec:generate -- --prompt "<prompt>"` writes `tmp/planner-context.json` and `tmp/planner-brief.md`, defining the deterministic skill-phase contract for same-session authoring of `tmp/spec-candidate.json` without mutating `spec/deck-spec.json`
- `pnpm spec` promotes `tmp/spec-candidate.json` into canonical `spec/deck-spec.json` after normalization and structural validation, writes `tmp/review-context.json` plus `tmp/review-brief.md` on success, and reports stable failure kinds so the same skill session can retry one candidate-only fixup pass
- `pnpm spec:review` promotes the same-session skill-authored `tmp/spec-review-candidate.json` into `tmp/spec-review.json` and `output/spec-review.md`, while enforcing local `pass` / `warn` / `fail` coherence rules plus canonical deck-material/image-prompt scorecard validation for the semantic review artifact
- `pnpm media` requires `spec/deck-spec.json.status` to be `reviewed` or `media_ready`, generates required image/shared assets, and updates canonical spec status to `media_ready` when all required outputs exist
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` are expected to run inside that same skill-owned session before the workflow is considered complete for that prompt
- `pnpm validate` prints `INCOMPLETE (human-in-the-loop required)`
- If the only blocked steps are LibreOffice-backed, the command should still exit successfully and write a validation report

Expected in a local terminal:

- `pnpm validate` can complete successfully
- It produces rendered slide PNGs, a montage PNG, and a font report JSON

## Completed Scope Snapshot

1. Spec workflow
   - `pnpm spec:generate -- --prompt "<prompt>"` now writes `tmp/planner-context.json` and `tmp/planner-brief.md`.
   - The same skill-owned session writes `tmp/spec-candidate.json`, and `pnpm spec` promotes it into canonical `spec/deck-spec.json`.
   - `pnpm spec` remains deterministic: it normalizes workflow-managed fields, validates structure, and refuses to leave an invalid canonical spec behind.
   - Canonical spec artifacts now use stable `spec/` vocabulary, including `asset_manifest`, `slide_mapping`, and the project-local `spec/deck-spec.schema.json`.
   - Semantic review is a separate same-session phase: `pnpm spec` writes `tmp/review-context.json` and `tmp/review-brief.md`, the skill writes `tmp/spec-review-candidate.json`, and `pnpm spec:review` promotes the formal review artifacts.

2. Media workflow
   - `pnpm media` is implemented as the only Gemini-dependent command in v1.
   - It reads canonical requirements from `spec/deck-spec.json`, writes outputs into `media/generated-images/`, and updates canonical asset/spec status through `generated` and `media_ready`.
   - The current shared-media contract is the basis for any future secondary provider work.

3. Deck composition
   - The example project now consumes canonical spec data and generated media during deterministic PPT build.
   - `src/buildDeck.ts`, `src/presentationModel.ts`, and regression tests are aligned with the spec-driven workflow rather than a hardcoded narrative model.

4. Session routing and reruns
   - The start of every skill-owned session is now an intent-routing step for `new_project` or `revise_existing_project`.
   - Revision feedback is handled as a new prompt that reruns the target project's end-to-end workflow instead of manually patching intermediate candidate files.

## Optional Follow-On

- Add an optional secondary image provider only if it can fit behind the existing `pnpm media` and `media/generated-images/` contract without reintroducing ambiguous workflow surfaces.

## Note

- This plan intentionally does not track long-range speculative goals beyond the active short-term implementation items above.
- If the workflow or interface changes later, update `FLOW.md`, `README.md`, `references/project-workflow.md`, and the related docs first, then update this plan.
