# Execution Plan: Shared Deck-Spec Runtime

This file is the single source of truth for the current shared-root / shared-package refactor.

## Context and Orientation

- Workspace root: `/Volumes/BiGROG/skills-test`
- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Development loop:
  - prove behavior in the demo deck root and demo project
  - sync reusable changes back into the skill repo templates, scripts, and docs
  - keep the skill repo as the reusable source of truth
- Current boundary:
  - shared runtime lives at `<deck-root>/packages/deck-spec-module/`
  - that shared runtime is a stateless black box: callers pass prompt, project slug, API key, and explicit output paths; the module returns only typed results plus artifact files
  - project code keeps only project content, thin wrappers, media adapters, tests, and outputs
  - project-local planner/runtime code under `src/deck-spec-module/{planning,reviewing,...}` is retired

## Desired Outcome

The operator path must be:

1. classify the prompt as `new_project` or `revise_existing_project`
2. converge the deck root and target project scaffold
3. run `pnpm spec -- --prompt "<prompt>"`
4. run `pnpm spec:validate`
5. run `pnpm media`
6. run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
7. optionally run `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"]`
8. run `pnpm validate` in a local terminal when LibreOffice-backed checks are required

Session rules that remain in scope:

- one user prompt maps to one skill-owned end-to-end session
- resolve the target project before changing files
- if the session is already scoped, confirm the active project with `.ai-native-slides/project.json` and `.ai-native-slides/state.json`
- for the current maintenance loop, revision prompts default to `ai-native-product-deck` unless the user explicitly asks for another project or a fresh one
- deterministic CLI commands are guardrails inside the same session, not approval checkpoints
- human review begins only after deliverables exist; revision feedback re-enters as a new prompt

The runtime contract must stay:

- shared package path: `packages/deck-spec-module/`
- stateless black-box boundary:
  - the module does not discover the active project on its own
  - the module does not infer canonical-spec or artifact output paths
  - the module does not depend on project-local mutable runtime state
  - the module does not write inside its own package directory
  - the caller supplies inputs; the module either publishes the canonical spec plus artifacts on success or leaves the canonical target untouched on failure
- prompt-driven API:
  - `runDeckSpecModule({ prompt, projectSlug, apiKey, model?, seed?, paths: { canonicalSpecPath, artifactRootDir } })`
  - `runDeckSpecValidateModule({ canonicalSpecPath, reportPath? })`
- typed failure codes:
  - `prompt_invalid`
  - `planning_failed`
  - `semantic_review_failed`
  - `contract_validation_failed`
- fixed artifact bundle on every `pnpm spec` / `pnpm spec:live` run:
  - `result.json`
  - `diagnostics.json`
  - `candidate.primary.json`
  - `candidate.fallback.json`
  - `review.final.json`
  - `report.md`
- project wrapper defaults:
  - canonical spec: `<project>/spec/deck-spec.json`
  - artifact root: `<deck-root>/tmp/deck-spec-module/<project-slug>/`
- media/build rules:
  - `pnpm media` is the only post-spec Gemini image-generation step in v1
  - `pnpm media` reads `GEMINI_API_KEY` from the current shell or `<deck-root>/.env`
  - `pnpm media` requires `spec/deck-spec.json.status` to be `reviewed` or `media_ready`
  - canonical media outputs land in `media/generated-images/`
  - `pnpm build` remains deterministic and offline

Current open gap:

- deterministic local validation is green
- one successful provider-backed `pnpm spec:live` run is still required

## Progress

- [x] 2026-03-15 12:24 PDT: scaffolded the shared package under `assets/root_templates/packages/deck-spec-module/` and synced root metadata into the demo deck root.
- [x] 2026-03-15 13:37 PDT: completed the writer-first shared runtime slice. Shared-package typecheck passed, deterministic package tests passed, and the demo project passed `pnpm typecheck`, `pnpm test`, and `pnpm spec:validate`.
- [x] 2026-03-15 13:39 PDT: added root-level live smoke support as `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"]`.
- [x] 2026-03-15 14:26 PDT: removed remaining legacy planner/compat tails from the active workspace and refreshed the demo validation report.
- [x] 2026-03-15 14:43 PDT: hardened the stateless boundary. Shared CLIs now require explicit output paths, project wrappers forward canonical-spec and artifact-root paths explicitly, and the package rejects writes into its own directory.
- [x] 2026-03-15 15:03 PDT: compressed and aligned repo docs so the remaining operator-facing docs describe the same shared-runtime contract.
- [x] 2026-03-15 15:30 PDT: tightened the plan wording so `deck-spec-module` is described explicitly as a stateless black box with caller-owned discovery and path selection, module-owned publish semantics, and no hidden package-local writes.
- [x] 2026-03-15 15:37 PDT: aligned `README.md`, `SKILL.md`, and `references/project-workflow.md` with the current code surface so they now describe the shared module as a stateless black box, wrapper-owned path selection, explicit output-path requirements, and non-mutating failure semantics.
- [ ] 2026-03-15 15:09 PDT: provider-backed acceptance is still open. Current `spec:live` attempts reached the provider path but failed with `planning_failed` (`fetch failed`) and `contract_validation_failed` after fallback repair.

## Plan of Work

### Milestone 1: Keep the deterministic path stable

Goal:

- shared package remains the only planner/validator runtime and stays a stateless black box
- project wrappers stay thin
- docs and scaffold keep matching the implemented contract

Validation:

- root/project preflight passes
- shared package typecheck and tests pass
- demo project lint/typecheck/test/build/spec:validate stay green
- wrappers still own deck-root / project-root discovery and default path selection

### Milestone 2: Close provider-backed acceptance

Goal:

- `pnpm spec:live` succeeds with a real provider-backed planning run
- the temp output contains a validated canonical spec plus full artifact bundle
- the project canonical spec is not mutated during live smoke

Validation:

- rerun the current guarded `pnpm spec:live` command
- inspect temp artifacts
- confirm the canonical project spec file did not change

## Concrete Steps

- [x] Move prompt-to-spec planning, canonicalization, validation, semantic review, and artifact writing into the shared package.
- [x] Keep converge order explicit: run `ensure_deck_root.sh` before `init_deck_root.sh` when root repair is needed, and `ensure_deck_project.sh` before `init_deck_project.sh` when scaffold repair is needed.
- [x] Convert project `src/spec/*` into thin wrapper / re-export surfaces.
- [x] Remove retired planner/runtime template files from the project scaffold.
- [x] Keep black-box ownership explicit: wrappers discover context and choose paths; the module consumes explicit inputs and owns publish / artifact behavior.
- [x] Keep media generation as a separate subsystem under `src/asset-pipeline/*`.
- [x] Add deterministic shared-package coverage for valid output, fallback repair, semantic-review failure, prompt failure, malformed model output, and output-path guards.
- [x] Add and document root-level `pnpm spec:live`.
- [x] Keep deck authoring in the same session after planning succeeds: revise `src/buildDeck.ts`, `src/presentationModel.ts`, project tests, then run lint/typecheck/test/build.
- [ ] Inspect repeated live-smoke artifact drift and decide whether prompt hardening alone is enough or a deterministic repair pass is required.
- [ ] Rerun one successful provider-backed `pnpm spec:live` when provider/network conditions permit.

## Validation and Acceptance

Deterministic validation verified on 2026-03-15:

- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/ensure_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck --json`
- `bash /Volumes/BiGROG/skills-test/ai-native-slides/scripts/ensure_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck --json`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && ../../node_modules/.bin/vitest run tests/deckSpecCli.test.ts tests/deckSpecModule.test.ts tests/deckSpecContract.test.ts tests/deckSpecReviewing.test.ts`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck && node --import tsx -e 'import { runDeckSpecValidateModule } from "./packages/deck-spec-module/src/public-api.ts"; await runDeckSpecValidateModule({ canonicalSpecPath: "./projects/ai-native-product-deck/spec/deck-spec.json", reportPath: "./tmp/review-deck-spec-validate-report-20260315T1458.md" }); console.log("validate ok")'`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm lint`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm typecheck`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm test`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm test -- --run tests/promptSpecWorkflow.test.ts`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm build`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm spec:validate`
- `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm validate`

Provider-backed acceptance status on 2026-03-15:

- guarded live-smoke command:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a six-slide deck about shared deck-spec black-box planning, validation, semantic review, and deterministic build delivery." --label "black-box-refactor-acceptance-escalated"`
- simpler-prompt retry:
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --tmp-root-dir "./tmp/deck-spec-module-live/ai-native-product-deck" --prompt "Create a simple six-slide deck about canonical deck-spec planning, structural validation, semantic review, media generation, and deterministic build delivery. Keep the slide structure concrete and simple." --label "black-box-refactor-acceptance-simple"`
- observed outcomes:
  - one run reached the provider and failed with `contract_validation_failed`
  - another run failed with `planning_failed` / `fetch failed`
  - temp artifacts were written under `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/`

Acceptance bar:

- deterministic matrix stays green
- one provider-backed `pnpm spec:live` run writes a validated temp canonical spec and artifact bundle
- the project canonical spec remains untouched during live smoke

## Idempotence and Recovery

- `scripts/init_deck_root.sh` is safe to rerun. It refreshes root-managed files and dependencies without requiring destructive cleanup.
- `scripts/init_deck_project.sh` is safe to rerun. It refreshes template-managed files without overwriting prompt-generated deck content.
- `pnpm spec -- --prompt "<prompt>"` is safe to rerun. Canonical publish happens only on success.
- `pnpm media` is safe to rerun. It may overwrite manifest-owned generated files but does not delete historical extras automatically in v1.
- `pnpm spec:live` is safe to rerun. It writes into a timestamped directory under the caller-selected `--tmp-root-dir`.
- If a provider-backed run fails, inspect the emitted artifact bundle first. Do not manually patch canonical project files as a workaround.

## Decision Log

- 2026-03-15: the official prompt-driven API is writer-first `runDeckSpecModule(...)`, not a value-returning planner helper.
- 2026-03-15: artifact-bundle writes are always on; `--debug` is no longer part of the supported happy path.
- 2026-03-15: shared CLIs do not infer runtime output locations. Callers must pass explicit output paths.
- 2026-03-15: `deck-spec-module` is treated as a stateless black box, not as a project-aware orchestrator. Project discovery, default-path selection, and workspace-specific context stay in wrappers.
- 2026-03-15: `pnpm spec:live` writes only to temp output and never mutates the project canonical spec.
- 2026-03-15: `src/asset-pipeline/*` remains separate from the shared planning/validation runtime.

## Surprises and Discoveries

- The biggest remaining risk is not local wiring. It is provider-backed candidate drift.
- Repeated live-smoke artifacts showed concrete schema drift patterns:
  - `card` blocks emitted with `text_asset_id` instead of `title_asset_id` + `body_asset_id`
  - `metric` blocks emitted with `text_asset_id` instead of `value_asset_id` + `label_asset_id`
- Provider-backed failure modes split into two different classes and must stay distinguished:
  - external failure: `planning_failed` / `fetch failed`
  - contract failure: `contract_validation_failed` after fallback repair
- Preflight drift earlier in the day came from package-local temp output, not from the shared runtime contract itself.

## Outcomes and Retrospective

- The shared `deck-spec-module` runtime is now the real stateless black-box planner/validator boundary.
- The demo project is reduced to project content plus thin wrappers and still validates end to end in the deterministic path.
- Root/project preflight, docs, and scaffold boundaries now match the current contract.
- The remaining work is narrow and concrete: close provider-backed acceptance by reducing or absorbing model contract drift without weakening deterministic guarantees.
