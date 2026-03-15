# Execution Plan: Shared Deck-Spec Black-Box Runtime

This is the living execution plan for the shared `deck-spec-module` refactor.
It is self-contained so another implementer can continue from this file without chat history.

## Context and Orientation

- Workspace root: `/Volumes/BiGROG/skills-test`
- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Development loop:
  - prove behavior in the demo project and deck root
  - sync reusable changes back into the skill repo templates, scripts, and docs
  - keep the skill repo as the reusable source of truth

The old project-local planner and validator boundary is retired.
The active runtime boundary is now the shared package at `<deck-root>/packages/deck-spec-module/`.

## Desired Outcome

The workflow must support this operator path:

1. classify the user prompt as `new_project` or `revise_existing_project`
2. converge the shared deck root and the target project scaffold
3. run `pnpm spec -- --prompt "<prompt>"`
4. run `pnpm spec:validate`
5. run `pnpm media`
6. run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
7. optionally run `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>"` from the deck root for a real provider-backed smoke
8. run `pnpm validate` in a local terminal when LibreOffice-backed checks are required

The resulting runtime contract must be:

- shared package path: `packages/deck-spec-module/`
- official prompt-driven API:
  - `runDeckSpecModule({ prompt, projectSlug, apiKey, model?, seed?, paths: { canonicalSpecPath, artifactRootDir } })`
  - `runDeckSpecValidateModule({ canonicalSpecPath, reportPath? })`
- typed failure codes:
  - `prompt_invalid`
  - `planning_failed`
  - `semantic_review_failed`
  - `contract_validation_failed`
- project wrappers remain thin and project-local planner logic is removed
- the module always writes a fixed artifact bundle and owns the canonical spec write

## Progress

- [x] 2026-03-15 12:24 PDT: started the shared deck-spec black-box refactor by scaffolding `packages/deck-spec-module/` into the root template and syncing workspace metadata into the deck root.
- [x] 2026-03-15 13:32 PDT: repaired scaffold/preflight drift. Package tests and vitest cache now write only to workspace-local temp locations outside the installed package tree, root/project metadata temp files no longer use system temp, and `ensure_deck_root.sh --json` plus `ensure_deck_project.sh --json` both returned ready again for the demo workspace.
- [x] 2026-03-15 13:34 PDT: removed the last legacy project wrapper naming from the active scaffold by renaming `src/spec/promoteDeckSpecCandidate.ts` to `src/spec/runDeckSpec.ts`, updating bootstrap/ensure state keys, and confirming the prompt-driven workflow tests still pass.
- [x] 2026-03-15 13:37 PDT: completed the shared runtime slice and synced it end-to-end. The shared package typechecks, the deterministic module suite passes with 35 tests, the demo project passes `pnpm typecheck`, `pnpm test`, and `pnpm spec:validate`, and both root/project preflight JSON reports are green.
- [x] 2026-03-15 13:39 PDT: added an opt-in live smoke command at the deck root, later finalized as `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"]`.
- [x] 2026-03-15 13:53 PDT: removed the remaining legacy compat surface from the shared package by deleting the old `src/deck-spec-module/public-api.ts` export path and stopping the package public API from exposing `planDeckSpecFromPrompt(...)`.
- [x] 2026-03-15 13:57 PDT: fixed wrapper lint drift, reran demo project `pnpm lint`, and verified the thin-wrapper surface stays green after scaffold refresh.
- [x] 2026-03-15 14:01 PDT: rewrote README, FLOW, SKILL, `references/project-workflow.md`, and the plan docs so they now describe the writer-first shared package, always-on artifact bundles, project thin wrappers, and the current live-smoke status.
- [x] 2026-03-15 14:26 PDT: cleaned the remaining legacy tails from the active workspace by removing empty `src/planner-agent` and `src/spec/compat` directories, renaming test fixtures away from `plannerAgent*`, rerunning scaffold converge, and refreshing the demo validation report so it no longer references `--debug`.
- [x] 2026-03-15 14:43 PDT: hardened the stateless boundary. Shared CLIs now fail fast unless the caller passes explicit output paths, project wrappers forward the canonical spec path plus artifact root explicitly, the package rejects writes back into its own directory, and the new CLI guard tests pass in the shared package plus demo workflow coverage.
- [x] 2026-03-15 14:40 PDT: hardened the runtime boundary so shared CLIs no longer infer output locations, project wrappers now pass explicit canonical-spec and artifact-root paths, and `spec:live` now requires an explicit `--tmp-root-dir`.
- [x] 2026-03-15 14:50 PDT: reviewed completion status against the live runtime, corrected stale plan commands to match the guarded CLI contract, reran shared-package direct validate plus prompt-workflow coverage, and confirmed root preflight stayed green after test execution.
- [x] 2026-03-15 14:56 PDT: reran deck-root preflight and the shared-package direct validate after the plan cleanup, producing a fresh validation report and confirming the docs now describe only rerunnable commands.
- [ ] 2026-03-15 13:58 PDT: reran `pnpm spec:live` after the deterministic matrix turned green again. The command still reached the provider layer but failed with `planning_failed` / `fetch failed`, so provider-backed acceptance remains open even though local wiring is confirmed.
- [ ] 2026-03-15 13:40 PDT: one real live smoke attempt reached the provider layer but failed with `planning_failed` / `fetch failed`, so the command wiring is verified but the provider-backed acceptance still needs a successful rerun when network/provider conditions are stable.

## Plan of Work

### Milestone 1: Shared Runtime Package

Move planning, canonicalization, validation, semantic review, and artifact writing into the shared runtime package and keep project-local code as thin forwarding wrappers.

Success condition:

- shared runtime package exists at `packages/deck-spec-module/`
- project wrappers do not carry planner business logic
- prompt-driven planning is writer-first and stateless from the project’s perspective

Validation:

- package typecheck passes
- deterministic package tests pass
- demo project `pnpm spec:validate` still passes

### Milestone 2: Scaffold and Template Hard Cut

Delete retired project-local planner files, update managed-file boundaries, and keep only project content plus wrappers in the project scaffold.

Success condition:

- retired `src/deck-spec-module/{planning,reviewing,...}` template files are gone
- active wrapper path is `src/spec/runDeckSpec.ts`
- root/project preflight no longer checks retired files

Validation:

- `ensure_deck_root.sh --json`
- `ensure_deck_project.sh --json`
- `pnpm test` in the demo project

### Milestone 3: Documentation and Acceptance

Rewrite operator-facing docs and maintain the execution plan so the written contract matches the implemented one.

Success condition:

- docs describe the shared package as the only planner/validator runtime
- docs describe artifact bundles as always-on
- docs describe `pnpm spec:live` as opt-in acceptance
- no active doc path tells operators to use `--debug`, `spec:generate`, or `spec:review`

Validation:

- targeted grep over docs and plans shows no stale contract language
- final validation matrix is recorded here with concrete commands and outcomes

## Concrete Steps

- [x] Add shared package scaffolding under `assets/root_templates/packages/deck-spec-module/`
- [x] Add writer-first public API and shared CLIs for spec + validate
- [x] Convert project-local `src/spec/*` into thin re-export or forwarding wrappers
- [x] Remove retired project-local planner template files from `assets/templates/src/deck-spec-module/`
- [x] Keep media generation separate under `src/asset-pipeline/*`
- [x] Add deterministic shared-package tests for success, fallback, validation failure, prompt failure, atomic publish protection, and path-free diagnostics
- [x] Add root-level opt-in live smoke command
- [x] Rewrite README, FLOW, SKILL, MY-PLAN, and `references/project-workflow.md`
- [ ] Rerun one successful provider-backed live smoke when network/provider conditions permit

## Validation and Acceptance

Completed deterministic validation on 2026-03-15:

- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/ensure_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck --json`
- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/ensure_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck --json`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && ../../node_modules/.bin/vitest run tests/deckSpecCli.test.ts tests/deckSpecModule.test.ts tests/deckSpecContract.test.ts tests/deckSpecReviewing.test.ts`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck && node --import tsx -e 'import { runDeckSpecValidateModule } from "./packages/deck-spec-module/src/public-api.ts"; await runDeckSpecValidateModule({ canonicalSpecPath: "./projects/ai-native-product-deck/spec/deck-spec.json", reportPath: "./tmp/review-deck-spec-validate-report-20260315T1458.md" }); console.log("validate ok")'`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm typecheck`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm lint`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm test`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm test -- --run tests/promptSpecWorkflow.test.ts`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm build`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm spec:validate`

Provider-backed acceptance on 2026-03-15:

- historical attempts were made before `--tmp-root-dir` became mandatory on the live-smoke CLI.
- current equivalent rerun command:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a six-slide deck about shared deck-spec black-box planning, validation, semantic review, and deterministic build delivery." --label "black-box-refactor"`
- current equivalent rerun command with alternate label:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a six-slide deck about shared deck-spec black-box planning, validation, semantic review, and deterministic build delivery." --label "black-box-refactor-rerun"`
- observed result:
  - both attempts failed with `planning_failed`
  - provider-layer message on both attempts: `fetch failed`
- artifacts were written under `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/20260315T204018Z-black-box-refactor`
  and `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/20260315T205809Z-black-box-refactor-rerun`

Acceptance bar:

- deterministic matrix must stay green
- one provider-backed `pnpm spec:live` run should eventually produce a validated canonical spec in temp output and a validation report without mutating the project canonical spec

## Idempotence and Recovery

- `scripts/init_deck_root.sh` is safe to rerun; it refreshes shared runtime files and dependencies without requiring destructive cleanup.
- `scripts/init_deck_project.sh` is safe to rerun; it refreshes template-managed files and preserves prompt-generated deck content.
- `pnpm spec -- --prompt "<prompt>"` is safe to rerun; the shared module only overwrites the canonical spec on successful publish.
- `pnpm spec:live` is safe to rerun; it writes to a timestamped temp directory under the caller-selected `--tmp-root-dir`.
- If a provider-backed run fails, inspect the emitted artifact bundle in temp output rather than patching canonical project files manually.

## Decision Log

- 2026-03-15: the official public prompt-driven contract changed from a value-returning planner function to writer-first `runDeckSpecModule(...)`.
- 2026-03-15: the module now always emits an artifact bundle; there is no supported `--debug` mode on the happy path.
- 2026-03-15: project wrapper default artifact output is `<deck-root>/tmp/deck-spec-module/<project-slug>/`, but the shared package itself stays path-agnostic by requiring caller-provided paths.
- 2026-03-15: `src/asset-pipeline/*` remains a separate subsystem and is not folded into this module refactor.
- 2026-03-15: `pnpm spec:live` writes only to temp output so provider-backed acceptance cannot corrupt the project canonical spec.

## Surprises and Discoveries

- Preflight drift was caused by package-local temp output from tests and vitest cache, not by module logic itself.
- `rsync --delete` on the root package sync was not enough by itself; tests also had to stop recreating temp files under the installed package tree.
- The most persistent contract drift was in docs and wrapper naming, not in the deterministic runtime behavior.
- The provider-backed live smoke command can fail even when deterministic validation is fully green; those failures need to be recorded distinctly as provider/network issues, not treated as local contract regressions.

## Outcomes and Retrospective

- The shared deck-spec black-box runtime is now real, not project-local scaffolding.
- The demo workspace validates the shared package directly and the project only carries thin wrappers plus deck-specific content.
- Root/project preflight is trustworthy again after temp handling was moved back inside workspace-local directories.
- One remaining follow-up remains outside deterministic local control: a successful provider-backed `pnpm spec:live` rerun when the external fetch path is healthy.
