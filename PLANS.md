# Execution Plan: Shared Deck-Spec Runtime and Media Materialization

This file is the single source of truth for the current shared-root / shared-package refactor.
For module-internal design detail, use `/Volumes/BiGROG/skills-test/ai-native-slides/DECK-SPEC-MODULE-MATERIALIZATION.md` as the maintainer-only companion reference for this plan.

## Context and Orientation

- Workspace root: `/Volumes/BiGROG/skills-test`
- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Maintainer-only companion design reference: `/Volumes/BiGROG/skills-test/ai-native-slides/DECK-SPEC-MODULE-MATERIALIZATION.md`
- Development loop:
  - prove behavior in the demo deck root and demo project
  - sync reusable changes back into the skill repo templates, scripts, and docs
  - keep the skill repo as the reusable source of truth
- Current implemented boundary:
  - shared runtime lives at `<deck-root>/packages/deck-spec-module/`
  - that shared runtime is currently a stateless black box for prompt-driven spec planning, canonicalization, validation, semantic review, canonical publish, media materialization, and artifact writing
  - project-local planner/runtime code under `src/deck-spec-module/{planning,reviewing,...}` and the legacy `src/asset-pipeline/*` surface are retired
- Newly requested boundary change:
  - Gemini text-to-image generation should move into the same shared black box as prompt-driven spec planning
  - the black box should own both canonical-spec publish and media materialization as one prompt-owned session
  - artifact accounting for planning and media should be unified under one caller-owned runtime output root
- Important distinction that must remain explicit:
  - `spec/deck-spec.json` is the canonical contract
  - generated images are derived materializations from that contract
  - they belong to the same module run, but they are not the same artifact class and should not be forced into identical failure semantics
- Practical migration constraint:
  - in phase 1, unify ownership and reporting inside the shared package without widening the migration unnecessarily
  - keep project-facing publish paths stable unless there is a concrete reason to move them
  - the current stable project-facing defaults remain `<project>/spec/deck-spec.json` and `<project>/media/generated-images/`
- Current observed provider-backed failures:
  - repeated live-smoke runs produced `planning_failed` with `fetch failed`
  - repeated live-smoke runs produced `contract_validation_failed` after fallback repair
  - the timestamped live-smoke artifacts are written under `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/<timestamp>-<label>/artifacts/`

## Desired Outcome

The operator path must become:

1. classify the prompt as `new_project` or `revise_existing_project`
2. converge the deck root and target project scaffold
3. run `pnpm spec -- --prompt "<prompt>"`
4. run `pnpm spec:validate`
5. run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
6. optionally run `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"]`
7. run `pnpm validate` in a local terminal when LibreOffice-backed checks are required
8. use `--no-media` only when a deterministic or debug loop must skip image generation explicitly

Session rules that remain in scope:

- one user prompt maps to one skill-owned end-to-end session
- resolve the target project before changing files
- if the session is already scoped, confirm the active project with `.ai-native-slides/project.json` and `.ai-native-slides/state.json` when those records exist
- for the current maintenance loop, revision prompts default to `ai-native-product-deck` unless the user explicitly asks for another project or a fresh one
- deterministic CLI commands are guardrails inside the same session, not approval checkpoints
- human review begins only after deliverables exist; revision feedback re-enters as a new prompt

The target runtime contract must be:

- shared package path: `packages/deck-spec-module/`
- stateless black-box boundary:
  - the module does not discover the active project on its own
  - the module does not infer canonical-spec, artifact-root, or media-output paths
  - the module does not depend on project-local mutable runtime state
  - the module does not write inside its own package directory
  - the caller supplies explicit inputs and explicit publish locations
  - the module owns planning, canonicalization, validation, semantic review, canonical publish, media materialization, and run-artifact reporting
- target prompt-driven API:
  - `runDeckSpecModule({ prompt, projectSlug, apiKey, model?, seed?, paths: { canonicalSpecPath, artifactRootDir, mediaOutputDir }, media?: { enabled?: boolean } })`
  - `runDeckSpecValidateModule({ canonicalSpecPath, reportPath? })`
- typed failure codes:
  - `prompt_invalid`
  - `planning_failed`
  - `semantic_review_failed`
  - `contract_validation_failed`
  - `media_generation_failed`
- fixed artifact bundle on every `pnpm spec` / `pnpm spec:live` run:
  - `result.json`
  - `diagnostics.json`
  - `candidate.primary.json`
  - `candidate.fallback.json`
  - `review.final.json`
  - `generated-assets.manifest.json`
  - `media.result.json`
  - `media.failures.json`
  - `report.md`
- project wrapper defaults in phase 1:
  - canonical spec: `<project>/spec/deck-spec.json`
  - artifact root: `<deck-root>/tmp/deck-spec-module/<project-slug>/`
  - canonical media output dir: `<project>/media/generated-images/`
- publish semantics:
  - canonical spec publish happens only after planning, canonicalization, validation, and semantic review succeed
  - media materialization runs after canonical publish unless `media.enabled === false`
  - if media succeeds, canonical spec status advances from `reviewed` to `media_ready`
  - if media fails after canonical publish, the canonical spec remains published and remains at `reviewed`; the run still reports failure through typed artifacts and process exit status
  - live smoke writes temp canonical spec, temp media, and temp artifacts only into the caller-selected temp root and never mutates the project canonical outputs
- build rules:
  - `pnpm build` remains deterministic and offline
  - `pnpm build` consumes published canonical spec and published media only
  - Gemini remains responsible for planning output and image synthesis, but not for deck composition or validation logic

Current open gaps:

- acceptance for this migration slice is now green
- residual provider/network instability remains a background operational risk, but it is no longer a blocker for this refactor

## Progress

- [x] 2026-03-15 12:24 PDT: scaffolded the shared package under `assets/root_templates/packages/deck-spec-module/` and synced root metadata into the demo deck root.
- [x] 2026-03-15 13:37 PDT: completed the writer-first shared runtime slice. Shared-package typecheck passed, deterministic package tests passed, and the demo project passed `pnpm typecheck`, `pnpm test`, and `pnpm spec:validate`.
- [x] 2026-03-15 13:39 PDT: added root-level live smoke support as `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"]`.
- [x] 2026-03-15 14:26 PDT: removed remaining legacy planner/compat tails from the active workspace and refreshed the demo validation report.
- [x] 2026-03-15 14:43 PDT: hardened the stateless boundary. Shared CLIs now require explicit output paths, project wrappers forward canonical-spec and artifact-root paths explicitly, and the package rejects writes into its own directory.
- [x] 2026-03-15 15:03 PDT: compressed and aligned repo docs so the remaining operator-facing docs describe the same shared-runtime contract.
- [x] 2026-03-15 15:30 PDT: tightened the plan wording so `deck-spec-module` is described explicitly as a stateless black box with caller-owned discovery and path selection, module-owned publish semantics, and no hidden package-local writes.
- [x] 2026-03-15 15:37 PDT: aligned `README.md`, `SKILL.md`, and `references/project-workflow.md` with the current code surface so they now describe the shared module as a stateless black box, wrapper-owned path selection, explicit output-path requirements, and non-mutating failure semantics.
- [x] 2026-03-15 15:57 PDT: expanded this execution plan to cover shared black-box media materialization, phase-aware publish semantics, unified run artifacts, and the requirement for a dedicated design note instead of a second `PLANS.md`.
- [x] 2026-03-15 16:08 PDT: moved the black-box design note to `/Volumes/BiGROG/skills-test/ai-native-slides/DECK-SPEC-MODULE-MATERIALIZATION.md` so it is clearly maintainer-facing and no longer mixed into user-facing `references/`.
- [x] 2026-03-15 16:12 PDT: clarified in `PLANS.md` that `DECK-SPEC-MODULE-MATERIALIZATION.md` is the maintainer-only companion design reference for black-box development and should not be surfaced through `SKILL.md`.
- [x] 2026-03-15 16:30 PDT: implemented the shared-media migration. The shared package now owns media materialization, project-local `asset-pipeline` is retired, `pnpm media` is removed, and `pnpm spec` owns the media phase by default with an explicit `--no-media` escape hatch.
- [x] 2026-03-15 22:38 PDT: closed the remaining deterministic gaps. Added coverage for rerun-after-partial-media-failure recovery, live-smoke temp path isolation, and pre-publish canonical non-mutation, then refreshed the demo deck root and reran the shared package matrix successfully.
- [x] 2026-03-15 22:38 PDT: fixed `validateDeckSpecFileFromPath(...)` so temp live-smoke canonical specs validate against the bundled schema and the document's own `project_slug`, instead of incorrectly assuming the temp run root is the project root.
- [x] 2026-03-15 22:41 PDT: provider-backed acceptance was temporarily blocked by mixed `fetch failed` and contract-drift failures, and the emitted temp artifacts were preserved for follow-up triage.
- [x] 2026-03-16 12:16 PDT: triaged the latest escalated live-smoke artifact and chose planner prompt hardening before any deterministic repair layer because the drift was systematic field-shape aliasing (`card` / `metric` / `timeline` blocks collapsing into `text_asset_id`).
- [x] 2026-03-16 12:19 PDT: hardened the planner prompt with explicit block-field rules and canonical snippets for `bullet_list`, `card`, `metric`, and timeline step shapes, refreshed the demo deck root, reran the shared deterministic matrix, and then passed provider-backed `pnpm spec:live` with `used_fallback: false`.
- [x] 2026-03-16 13:12 PDT: removed the last retired source-tree maintenance tails from skill scripts. `project.json` no longer emits `legacy_cleanup_targets`, `ensure_deck_project.sh` no longer exposes retired source-dir status flags, `bootstrap_deck_project.sh` no longer carries source-tree cleanup branches for removed layouts, and the single-workspace migration script dropped its `asset-pipeline` import rewrite. Added a demo regression test to lock that reduced maintenance surface.
- [x] 2026-03-16 13:55 PDT: upstreamed the demo-only maintenance regression into the reusable project template as `tests/projectScaffoldMaintenance.test.ts`, updated bootstrap/init/ensure/run-project script contracts so the new scaffold test is template-managed but does not count as prompt-generated content coverage, refreshed the demo project scaffold, and reran the full deterministic demo matrix successfully.
- [x] 2026-03-16 14:33 PDT: hardened validate boundary and freshness semantics. `spec:validate` now routes through the shared package's `pnpm` CLI instead of direct internal `src/cli/*` paths, `validate-local.sh` now requires a fresh build artifact from the current run, added direct `runDeckSpecValidateModule(...)` coverage plus validate-wrapper regression coverage, refreshed the demo deck root/project, and reran the targeted deterministic validation set successfully.
- [x] 2026-03-16 14:39 PDT: clarified the operator-facing docs so they now say explicitly that the stable shared validate entrypoint is the package `pnpm` CLI, while also recording that `deck-spec-module` is not yet fully integration-isolated overall because non-validate wrapper surfaces still deep-import `packages/deck-spec-module/src/*`.
- [x] 2026-03-16 15:20 PDT: completed the minimal operator CLI boundary convergence. Added package-local `spec` and `spec:live` scripts, rewired deck-root and project shell entrypoints to call `pnpm --dir` package CLIs instead of internal `src/cli/*` file paths, added manifest/scaffold regressions, refreshed the demo deck root/project, and reran the targeted deterministic validation set successfully.
- [ ] 2026-03-16 15:37 PDT: started the TypeScript public-boundary isolation slice. This pass will keep `projects/*` outside the workspace, add root-linked package resolution for `@ai-native-slides/deck-spec-module`, replace project wrapper deep imports with curated public entrypoints, and leave planner/media/reviewing test deep imports for the later seam-injection slice.

## Plan of Work

### Milestone 1: Define the revised black-box contract without breaking statelessness

Goal:

- make the target boundary for `spec + media materialization` explicit
- preserve caller-owned discovery and explicit path selection
- preserve recoverability by keeping canonical publish and media materialization as separate phases inside one module run

Validation:

- `PLANS.md` documents the revised contract, publish semantics, and recovery rules
- a dedicated design note records the internal phase model and migration choices
- no new duplicate `PLANS.md` is introduced under `deck-spec-module`

### Milestone 2: Move media orchestration into the shared package while keeping wrappers thin

Goal:

- shared package owns provider-env lookup, prompt compilation, image generation, normalization, image writes, spec status updates, and media result artifacts
- project wrappers stay responsible only for deck-root / project-root discovery and default path selection
- the project-local `pnpm media` surface is retired cleanly

Validation:

- shared package typecheck and deterministic tests pass
- project wrapper code becomes thinner rather than thicker
- project-facing publish paths remain explicit and caller-owned

### Milestone 3: Stabilize deterministic behavior and close provider-backed acceptance

Goal:

- deterministic package and project validation stay green after media moves into the black box
- `pnpm spec:live` succeeds end to end with temp canonical spec, temp media outputs, and temp artifact bundle
- project canonical outputs remain untouched during live smoke

Validation:

- rerun the deterministic matrix
- rerun guarded `pnpm spec:live`
- inspect temp artifacts and temp generated media
- confirm project canonical outputs did not change

## Concrete Steps

- [x] Move prompt-to-spec planning, canonicalization, validation, semantic review, and artifact writing into the shared package.
- [x] Keep converge order explicit: run `ensure_deck_root.sh` before `init_deck_root.sh` when root repair is needed, and `ensure_deck_project.sh` before `init_deck_project.sh` when scaffold repair is needed.
- [x] Convert project `src/spec/*` into thin wrapper / re-export surfaces.
- [x] Remove retired planner/runtime template files from the project scaffold.
- [x] Keep black-box ownership explicit: wrappers discover context and choose paths; the module consumes explicit inputs and owns publish / artifact behavior.
- [x] Add deterministic shared-package coverage for valid output, fallback repair, semantic-review failure, prompt failure, malformed model output, and output-path guards.
- [x] Add and document root-level `pnpm spec:live`.
- [x] Keep deck authoring in the same session after planning succeeds: revise `src/buildDeck.ts`, `src/presentationModel.ts`, project tests, then run lint/typecheck/test/build.
- [x] Add a dedicated maintainer-facing design note at `/Volumes/BiGROG/skills-test/ai-native-slides/DECK-SPEC-MODULE-MATERIALIZATION.md` for the revised `deck-spec-module` materialization contract.
- [x] Move project-local media generation orchestration into the shared package while reusing the existing provider and normalization code where practical.
- [x] Introduce explicit shared-module support for `mediaOutputDir` while preserving explicit caller-owned output selection.
- [x] Extend the shared API, CLI wiring, and artifact manifest so spec planning and media materialization are reported in one run.
- [x] Retire `pnpm media` and make `pnpm spec` the only provider-backed project command:
  - `pnpm spec` runs planning plus media by default
  - `--no-media` is the only supported escape hatch
- [x] Preserve pre-publish non-mutation guarantees:
  - planning, validation, and semantic-review failures must leave the canonical target untouched
- [x] Preserve recoverable post-publish media behavior:
  - if media fails after canonical publish, keep the canonical spec at `reviewed`
  - successful image assets may already exist in the publish directory
  - retries must be safe and overwrite manifest-owned outputs deterministically
- [x] Add deterministic shared-package coverage for:
  - no required images
  - all required images generated successfully
  - partial image-generation failure
  - provider-env resolution failure
  - rerun after partial media success
  - temp live-smoke path isolation
- [x] Update project templates and wrappers so media generation is no longer orchestrated from project-local business logic.
- [x] Inspect repeated live-smoke artifact drift and decide whether prompt hardening alone is enough or a deterministic repair pass is required.
  - decision taken: prompt hardening was the right first move because the observed drift was systematic field-shape aliasing, not random semantic confusion
  - current outcome: one provider-backed success landed after prompt hardening, so deterministic repair is not required for this phase
- [x] Rerun one successful provider-backed `pnpm spec:live` when provider/network conditions permit.
- [x] After the new contract lands, sync `README.md`, `SKILL.md`, and `references/project-workflow.md` to the updated surface.

## Validation and Acceptance

Deterministic validation verified on 2026-03-15 for the integrated spec-plus-media shared-runtime contract:

- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/init_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck`
- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/init_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck ai-native-product-deck`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && pnpm exec tsc --noEmit -p tsconfig.json`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && pnpm exec vitest run tests/deckSpecCli.test.ts tests/deckSpecLiveSmoke.test.ts tests/deckSpecModule.test.ts tests/deckSpecContract.test.ts tests/deckSpecReviewing.test.ts tests/deckSpecMedia.test.ts`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm lint`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm typecheck`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm test`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm build`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm spec:validate`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm validate`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm exec vitest run tests/projectScaffoldMaintenance.test.ts`

Operator CLI boundary deterministic validation verified on 2026-03-16:

- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/init_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck`
- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/init_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck ai-native-product-deck`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && pnpm exec vitest run tests/deckSpecCli.test.ts tests/deckSpecLiveSmoke.test.ts`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm exec vitest run tests/projectScaffoldMaintenance.test.ts`

Provider-backed acceptance status for the current contract:

- guarded live-smoke command:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a six-slide deck about shared deck-spec black-box planning, validation, semantic review, and deterministic build delivery." --label "black-box-refactor-acceptance-escalated"`
- simpler-prompt retry:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery. Keep the slide structure concrete and simple." --label "black-box-refactor-acceptance-simple"`
- sandboxed retry after validator/path fix:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery. Keep the slide structure concrete and simple." --label "media-phase-acceptance-20260315"`
- escalated retry after validator/path fix:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery. Keep the slide structure concrete and simple." --label "media-phase-acceptance-20260315-escalated"`
- successful prompt-hardening acceptance run:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery. Keep the slide structure concrete and simple." --label "prompt-hardening-acceptance-20260316"`
- observed outcomes:
  - one run reached the provider and failed with `contract_validation_failed`
  - multiple runs failed with `planning_failed` / `fetch failed`
  - after the validator/path fix, the sandboxed run still failed with `planning_failed` / `fetch failed`
  - after the validator/path fix, the escalated run emitted a primary candidate artifact bundle, but the overall live smoke still failed with `planning_failed` / `fetch failed` before a successful fallback/provider completion
  - after planner prompt hardening on 2026-03-16, the live smoke succeeded at `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/20260316T191802Z-prompt-hardening-acceptance-20260316/` with `used_fallback: false`, a validated temp canonical spec, generated temp media, a complete artifact bundle, and no project canonical output mutation
  - temp artifacts were written under `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/`

Acceptance bar for the revised contract:

- deterministic matrix stays green after moving media orchestration into the shared package
- one deterministic test pass covers both canonical publish and media materialization reporting
- one provider-backed `pnpm spec:live` run writes:
  - a validated temp canonical spec
  - temp generated media in the caller-owned temp publish directory
  - the full unified artifact bundle
- the project canonical spec and project canonical media outputs remain untouched during live smoke

Acceptance status:

- satisfied on 2026-03-16 by the `prompt-hardening-acceptance-20260316` run

## Idempotence and Recovery

- `scripts/init_deck_root.sh` is safe to rerun. It refreshes root-managed files and dependencies without requiring destructive cleanup.
- `scripts/init_deck_project.sh` is safe to rerun. It refreshes template-managed files without overwriting prompt-generated deck content.
- `pnpm spec -- --prompt "<prompt>"` remains safe to rerun.
  - if planning fails before canonical publish, the canonical target stays untouched
  - if planning succeeds and media later fails, the canonical spec remains published at `reviewed`
- media materialization inside the shared package must be safe to rerun.
  - reruns may overwrite manifest-owned generated files
  - reruns do not need destructive cleanup before regeneration
  - phase-1 migration does not delete historical extra files automatically
- `pnpm spec:live` is safe to rerun. It writes into a timestamped directory under the caller-selected `--tmp-root-dir`.
- If a provider-backed run fails, inspect the emitted artifact bundle first. Do not manually patch canonical project files as a workaround.
- If media fails after canonical publish, recovery is a rerun of the shared module, not manual JSON patching or manual image-file bookkeeping.

## Decision Log

- 2026-03-15: the official prompt-driven API is writer-first `runDeckSpecModule(...)`, not a value-returning planner helper.
- 2026-03-15: artifact-bundle writes are always on; `--debug` is no longer part of the supported happy path.
- 2026-03-15: shared CLIs do not infer runtime output locations. Callers must pass explicit output paths.
- 2026-03-15: `deck-spec-module` is treated as a stateless black box, not as a project-aware orchestrator. Project discovery, default-path selection, and workspace-specific context stay in wrappers.
- 2026-03-15: `pnpm spec:live` writes only to temp output and never mutates the project canonical spec.
- 2026-03-15: do not create a second `PLANS.md` under `deck-spec-module`; keep this file as the only execution plan for the current workstream and add a separate maintainer-facing design note for deeper module-internal detail.
- 2026-03-15: Gemini image generation will move into the shared black box, but canonical spec and generated media will keep distinct phase semantics for recovery and reporting.
- 2026-03-15: phase 1 of the migration keeps project-facing publish paths stable and explicit (`spec/deck-spec.json` and `media/generated-images/`) instead of immediately collapsing everything into a single new run-root abstraction.
- 2026-03-15: the black-box design note belongs at the skill repo root, not under `references/`, because `references/` is reserved for user-facing workflow and helper documents.
- 2026-03-15: the legacy project-local `src/asset-pipeline/*` surface will be removed entirely instead of preserved as a compatibility shim.
- 2026-03-15: `pnpm media` will be retired instead of preserved as a wrapper; `pnpm spec` becomes the default end-to-end provider-backed entrypoint, with `--no-media` retained only for explicit skip/debug cases.
- 2026-03-16: maintenance scripts should stop surfacing retired source-tree compatibility metadata once the shared-media migration is complete; only current scaffold/state and still-relevant generated-directory cleanup should remain operator-visible.
- 2026-03-16: the reusable scaffold may ship a template-managed maintenance regression test, but operator/content readiness must continue to require at least one non-template project test generated from the prompt-owned deck content.
- 2026-03-16: the stable operator entrypoint for shared validation is the package `pnpm spec:validate` CLI, while TypeScript consumers should stay on `src/public-api.ts`; project wrappers should not call internal `src/cli/*` validate files directly.
- 2026-03-16: the minimal operator CLI convergence should use package-local `pnpm` scripts for `spec`, `spec:validate`, and `spec:live`; do not add `bin` or `exports` until the later TypeScript/public-surface isolation slice.
- 2026-03-16: the TypeScript public-boundary isolation slice will use a root-linked package strategy rather than adding `projects/*` to the workspace; deck-root `node_modules` must expose `@ai-native-slides/deck-spec-module` so project wrappers can resolve curated package subpaths through the parent install.
- 2026-03-16: `deck-spec-module` exports for TypeScript consumers should stay curated and minimal: `"."` for runtime/module entrypoints, `"./spec"` for deck-spec contract/path/helper utilities, and `"./review"` for review contract/render/validation helpers. Do not expose `./src/*` or planner/media/reviewing internals.
- 2026-03-16: `pnpm validate` must validate only the `.pptx` produced by the current build run; if build fails or does not report a fresh artifact path, downstream artifact checks must stop immediately.
- 2026-03-16: `deck-spec-module` should not yet be described as fully independent at the integration boundary; validate is now on the intended CLI/public-API boundary, but other wrapper surfaces still depend on `packages/deck-spec-module/src/*`.

## Surprises and Discoveries

- The biggest remaining risk is not local wiring. It is provider-backed candidate drift plus provider/network instability.
- Repeated live-smoke artifacts showed concrete schema drift patterns:
  - `card` blocks emitted with `text_asset_id` instead of `title_asset_id` + `body_asset_id`
  - `metric` blocks emitted with `text_asset_id` instead of `value_asset_id` + `label_asset_id`
- The prompt hardening fix closed the current drift class without adding a deterministic repair layer:
  - the successful 2026-03-16 provider-backed run passed validation and semantic review on the primary attempt
  - `used_fallback: false` is the strongest signal that the planner prompt, not a downstream repair path, fixed the failure mode we were seeing
- The original path-based validation helper was too project-layout-specific for live smoke:
  - `runDeckSpecValidateModule()` assumed `canonicalSpecPath` always lived under a real project root with a sibling `spec/deck-spec.schema.json`
  - temp live-smoke runs needed bundled-schema validation plus `project_slug`-aware context instead
- Provider-backed failure modes already split into two different classes and must stay distinguished:
  - external failure: `planning_failed` / `fetch failed`
  - contract failure: `contract_validation_failed` after fallback repair
- Actual live-smoke output layout is timestamped run directories with nested `artifacts/`, not a flat label-only directory.
- Some current docs mention `.ai-native-slides/project.json`, but the demo deck root currently exposes only `.ai-native-slides/state.json`; that discrepancy should be treated as doc/workflow drift and not as hidden runtime behavior.
- Moving Gemini image generation into the same black box increases the scope of one module run and therefore requires explicit phase-aware reporting instead of a single undifferentiated success/failure bit.
- After the media migration landed, the only remaining `asset-pipeline` traces were no longer runtime code; they were maintenance metadata, retired-path cleanup branches, and one migration rewrite in shell scripts.
- Once the scaffold maintenance regression was promoted from demo into the reusable template, `run-project.sh`, `init_deck_project.sh`, and `ensure_deck_project.sh` all needed the same exclusion rule so that the template-managed test would not accidentally satisfy prompt-generated content-test gates.
- Routing project `spec:validate` through the package `pnpm` CLI exposed a real argument-passing footgun: a redundant `--` caused the shared validate CLI to receive `"--"` as its first argument and mis-resolve the project path into the package directory.
- The operator CLI boundary slice did not need package-surface redesign: package-local `pnpm` scripts plus template-managed regressions were sufficient to remove internal CLI file-path dependence from root/project shell workflows.
- The old `validate-local.sh` flow did not just prefer stale outputs when multiple `.pptx` files existed; it could also continue into Open XML / render / font checks after a failed build because the artifact path was chosen before the build ran.

## Outcomes and Retrospective

- The shared `deck-spec-module` runtime is already the real stateless black-box planner/validator/media boundary for canonical spec generation and media materialization.
- The demo project is reduced to project content plus thin wrappers and still validates end to end in the deterministic path.
- Root/project preflight, docs, and scaffold boundaries now match the current implemented spec-plus-media contract at the operator CLI layer.
- The remaining integration debt is now explicitly TypeScript/test deep-import coupling rather than operator CLI file-path coupling.
- Provider-backed acceptance is already satisfied; the remaining cleanup in this slice was maintenance-surface reduction, and that now has a demo regression test plus a slimmer script contract.
