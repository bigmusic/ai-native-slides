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
  - Users run `pnpm spec -- --prompt "<prompt>"`, `pnpm spec:validate`, `pnpm media`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate` from the project directory
  - The project still uses the shared root `node_modules/` and root `.venv/`
- `pnpm spec` and `pnpm media` are the Gemini-dependent commands in v1.
  - `pnpm spec` uses Gemini text generation inside the stateless deck-spec module
  - It reads `GEMINI_API_KEY` from the current shell or from `<deck-root>/.env`
  - `pnpm media` writes canonical generated files to `media/generated-images/`
  - It updates required image/shared asset status in `spec/deck-spec.json`
- Skill-agent responsibilities in the current slice include prompt routing, deck authoring, command orchestration, and interpreting validation/debug artifacts. Prompt-to-spec generation, semantic review, and one repair retry now live inside the stateless deck-spec module.
- The intended operator experience is one skill-agent-owned end-to-end session per user prompt.
  - That same session starts by routing the prompt to either `new_project` or `revise_existing_project`, then owns prompt intake, module invocation, deck authoring, media generation orchestration, and deliverable production for that target project.
  - If the prompt is revision feedback for an existing deck, the skill reruns that project's end-to-end workflow instead of manually patching intermediate candidate files.
  - If the prompt clearly asks for a new deck, the skill initializes or refreshes the requested `projects/<slug>/` scaffold first, then runs the same end-to-end workflow there.
  - Active project identity comes from explicit prompt wording first and current project metadata second, including `.ai-native-slides/project.json` and `.ai-native-slides/state.json` when the session is already scoped to one project.
- Post-deliverable review feedback is outside the tracked workflow phases.
  - When revision feedback arrives, it should be expressed as a new prompt that names the target project or clearly asks for a new one.
- Gemini responsibilities in v1 cover spec generation inside `pnpm spec` plus image generation during `pnpm media`; Gemini still does not own deck composition or validation policy.
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
- `src/deck-spec-module/public-api.ts`
- `src/deck-spec-module/prompt-interpreter/promptModel.ts`
- `src/deck-spec-module/asset-planning/assetBlueprints.ts`
- `src/deck-spec-module/canonicalization/finalizeDeckSpec.ts`
- `src/deck-spec-module/review-bridge/createSemanticReview.ts`
- `src/deck-spec-module/media/geminiImageProvider.ts`
- `src/deck-spec-module/media/providerEnv.ts`
- `src/deck-spec-module/media/providerPrompt.ts`
- `src/spec/contract.ts`
- `src/spec/deriveOutputFileName.ts`
- `src/spec/normalizeSystemManagedFields.ts`
- `src/spec/promoteDeckSpecCandidate.ts`
- `src/spec/readDeckSpec.ts`
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
- `pnpm media`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Deterministic deck-spec-module regression covers prompt-to-canonical-spec planning plus review-gated publish behavior.
- `vitest` cache is redirected to project-local `tmp/.vite`
- Re-running `init_deck_project.sh` preserves existing prompt-generated content instead of overwriting it
- `scripts/bootstrap_deck_project.sh` and `scripts/ensure_deck_project.sh --json` recognize the scaffold-managed `spec` / `media` modules and scripts in the example project
- `pnpm media` reads `GEMINI_API_KEY` from the current shell or `<deck-root>/.env`, writes deck-ready files into `media/generated-images/`, and updates canonical image asset status to `generated`

Expected in Codex:

- The same skill-owned session begins by classifying the prompt as `new_project` or `revise_existing_project` and resolving the target project from explicit prompt wording plus local project metadata when available
- `pnpm spec -- --prompt "<prompt>"` invokes the stateless deck-spec module, lets the module call the external planner model, and publishes canonical `spec/deck-spec.json` only after module-internal canonicalization, structural validation, semantic review, and one repair retry succeed
- `planDeckSpecFromPrompt(prompt, { apiKey, projectSlug, ... })` is now an explicit async module contract: the module no longer infers planner identity from `process.cwd()` or `process.env`, and bootstrap/ensure no longer treat retired planner-agent or review-promotion files as scaffold requirements
- `pnpm spec -- --prompt "<prompt>" --debug` is the only happy-path diagnostics mode; it writes `tmp/spec-candidate.json`, `tmp/spec-review.json`, `tmp/spec-diagnostics.json`, and `output/spec-review.md`
- `pnpm media` requires `spec/deck-spec.json.status` to be `reviewed` or `media_ready`, generates required image/shared assets, and updates canonical spec status to `media_ready` when all required outputs exist
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` are expected to run inside that same skill-owned session before the workflow is considered complete for that prompt
- `pnpm validate` prints `INCOMPLETE (human-in-the-loop required)`
- If the only blocked steps are LibreOffice-backed, the command should still exit successfully and write a validation report

Expected in a local terminal:

- `pnpm validate` can complete successfully
- It produces rendered slide PNGs, a montage PNG, and a font report JSON

## Completed Scope Snapshot

1. Spec workflow
   - `pnpm spec -- --prompt "<prompt>"` now routes prompt interpretation, canonical spec planning, and deterministic semantic review through the stateless deck-spec module.
   - `pnpm spec` publishes canonical `spec/deck-spec.json` on success and writes scratch review/candidate artifacts only when `--debug` is explicitly requested.
   - `pnpm spec` remains deterministic: it validates canonical structure before publish and refuses to overwrite a trusted canonical spec when module-internal review fails.
   - Canonical spec artifacts now use stable `spec/` vocabulary, including `asset_manifest`, `slide_mapping`, and the project-local `spec/deck-spec.schema.json`.
   - The target end state for the current cleanup pass is one planning entrypoint only: `pnpm spec -- --prompt "<prompt>"`.

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
