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
5. author or revise `src/buildDeck.ts`, `src/presentationModel.ts`, and project tests from the original prompt plus canonical spec, generated media, and the module artifact bundle
6. run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
7. optionally run `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"]`
8. run `pnpm validate` in a local terminal when LibreOffice-backed checks are required
9. use `--no-media` only when a deterministic or debug loop must skip image generation explicitly

Session rules that remain in scope:

- one user prompt maps to one skill-owned end-to-end session
- resolve the target project before changing files
- if the session is already scoped, confirm the active project with `.ai-native-slides/project.json` and `.ai-native-slides/state.json` when those records exist
- for the current maintenance loop, revision prompts default to `ai-native-product-deck` unless the user explicitly asks for another project or a fresh one
- deterministic CLI commands are guardrails inside the same session, not approval checkpoints
- after `pnpm spec` succeeds, the same session still owns second-stage project-content authoring from the original prompt plus black-box artifacts
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

- [x] 2026-03-17 12:31 PDT: finished the current clean-root rerun end to end: `pnpm spec`, `pnpm spec:validate`, second-stage authoring, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and wrapper-level `pnpm validate` are all green except for the expected human-in-the-loop LibreOffice rerun.
- [x] 2026-03-17 12:33 PDT: documented the second-stage canonical-contract guardrail in `SKILL.md` and `references/project-workflow.md` after the fresh authoring pass surfaced that consumers must read `slide_id`, `block_type`, and `asset_manifest.*` exactly as published.
- [x] 2026-03-17 12:16 PDT: confirmed the demo deck root had been cleared back to `.env` only and started a fresh operator-path rerun from clean bootstrap, with this session using the sugarcane-cleaner enterprise-tech prompt as `new_project ai-native-product-deck`.
- [x] 2026-03-15 12:24 PDT: established the shared runtime as the owner of prompt-to-spec execution.
- [x] 2026-03-15 14:43 PDT: locked the stateless boundary: caller-owned discovery and path selection, module-owned execution and reporting.
- [x] 2026-03-15 16:30 PDT: folded media materialization into the same runtime session and removed the separate project-local media path.
- [x] 2026-03-15 22:38 PDT: closed recovery and temp-live-smoke semantics, including non-mutation before publish and safe reruns after partial failure.
- [x] 2026-03-16 12:19 PDT: stabilized the provider-backed path by hardening planner guidance; acceptance later passed on the primary path.
- [x] 2026-03-16 16:55 PDT: converged operator, public-boundary, and test-boundary surfaces onto the shared package with thin wrappers.
- [x] 2026-03-16 17:39 PDT: closed remaining CLI/reporting edge cases around explicit scope, unique temp runs, and post-publish validation failure handling.
- [x] 2026-03-16 17:50 PDT: compressed this plan into a low-context handoff form without dropping boundary or acceptance state.
- [x] 2026-03-16 18:23 PDT: reran the skill from a clean demo deck root; `pnpm spec` and media generation succeeded, and that rerun confirmed the remaining gap lived in skill-side project-content authoring rather than in the shared black-box boundary.
- [x] 2026-03-16 18:35 PDT: repaired the clean-bootstrap template lint drift and the validation-report PPTX header wording in the skill repo, synchronized both fixes into the demo workspace, and reconfirmed the local loop through `pnpm validate`.
- [x] 2026-03-16 18:58 PDT: aligned skill docs, scaffold guardrails, and template tests around the two-stage operator flow so `pnpm spec` stops at spec/media/artifacts and project-content authoring remains skill-owned.
- [x] 2026-03-16 19:11 PDT: refreshed the demo project's template-managed files and reconfirmed the aligned contract through `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, targeted scaffold tests, and `pnpm build`.
- [x] 2026-03-16 19:43 PDT: fixed the shared package's fixed-bundle artifact drift so primary-success runs now emit `candidate.fallback.json` as a placeholder artifact and always surface both candidate artifact paths in `result.json`.
- [x] 2026-03-16 19:51 PDT: synced the shared package fix into the clean demo deck root, reconfirmed `deckSpecModule.test.ts`, reran `pnpm spec` with the sugarcane-cleaner prompt, and revalidated the fast loop through `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and human-in-the-loop `pnpm validate`.
- [x] 2026-03-17 15:46 PDT: started a fresh clean-root bug-hunt session against `/Volumes/BiGROG/skills-test/ai-education-deck`, treating the natural-language sugarcane prompt as `new_project ai-native-product-deck` and re-running the full skill workflow from bootstrap through validation to capture any remaining routing, bootstrap, authoring, or validation regressions.
- [x] 2026-03-17 16:21 PDT: reproduced a clean-root provider-backed failure where `pnpm spec` exited `semantic_review_failed` because planner-produced image prompt specs reached semantic review with empty `avoid_elements` arrays on a fresh rerun.
- [x] 2026-03-17 16:47 PDT: hardened the shared deck-spec template by repairing empty `image_prompt_spec.avoid_elements` arrays before semantic review, tightening planner prompt instructions so deck-safety exclusions are required, syncing the reusable fix into the demo deck root, and reconfirming the shared deterministic tests.
- [x] 2026-03-17 17:32 PDT: reran the same sugarcane prompt from the clean demo root through `pnpm spec` and `pnpm spec:validate`; the rerun published canonical spec, generated media, and the fixed artifact bundle successfully.
- [x] 2026-03-17 18:18 PDT: completed second-stage project authoring for the demo project, then reconfirmed `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate`; only expected human-in-the-loop LibreOffice steps remain, and the remaining overlap warnings are limited to the intentional timeline badge treatment on slide 4.
- [x] 2026-03-17 11:59 PDT: removed the accidental `MY-PLAN.md` resurrection and re-converged the workspace protocol on `PLANS.md` as the only execution-plan document.
- [x] 2026-03-17 12:06 PDT: audited the final demo deck against the skill repo and confirmed all reusable template-managed, helper, and shared-runtime changes had already been synchronized back into `ai-native-slides`; only deck-specific deliverables remain solely in the demo deck workspace, so clearing that deck will not lose reusable fixes.

## Plan of Work

### Milestone 1: Stateless Black-Box Contract `[done]`

- Wrappers discover context and choose explicit paths.
- `deck-spec-module` owns planning, validation, review, publish, media, and artifacts.

### Milestone 2: Shared Media Orchestration `[done]`

- Media generation/status/artifacts live in the shared package.
- Project-local `pnpm media` is retired; wrappers stay thin.

### Milestone 3: Deterministic And Provider Acceptance `[done]`

- Deterministic package/project checks stay green.
- One provider-backed `pnpm spec:live` succeeded with temp-only outputs and no canonical project mutation.

### Milestone 4: Skill-Side Two-Stage Contract `[done]`

- Skill docs and scaffold guardrails describe `pnpm spec` as black-box spec/media/artifact publication only.
- Second-stage authoring of `src/buildDeck.ts`, `src/presentationModel.ts`, and tests remains outside the black box and is explicitly skill-owned.

## Concrete Steps

- [x] Unified planning, review, publish, and media under one shared runtime boundary.
- [x] Preserved explicit repair and converge order for deck-root and project scaffolds.
- [x] Reduced the project layer to thin boundary adapters around the shared module.
- [x] Kept operator, public, and test surfaces narrow and intentional rather than implementation-driven.
- [x] Kept live-smoke execution explicit, temp-only, and non-mutating to canonical project outputs.
- [x] Rewrote the skill-side flow so prompt -> black-box artifacts -> agent-authored project content -> deterministic build is explicit across docs, scripts, and tests.

## Validation and Acceptance

- Status: accepted on 2026-03-16.
- 2026-03-15: integrated deterministic validation went green for the shared runtime and demo project.
- 2026-03-16: boundary-specific regressions stayed green across operator flow, public contract, test seam, and post-publish reporting.
- 2026-03-16: one provider-backed temp live-smoke run succeeded with validated temp spec, generated temp media, full artifacts, primary-path success, and no canonical project mutation.
- 2026-03-16: scaffold/template regression coverage now asserts the two-stage operator wording for `init_deck_project.sh`, `ensure_deck_project.sh`, `run-project.sh`, and `src/main.ts`.
- 2026-03-16: the demo project stayed green for `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test -- projectScaffoldMaintenance.test.ts`, and `pnpm build` after template refresh.
- 2026-03-17: a fresh clean-root rerun stayed green through root bootstrap, project bootstrap, repaired `pnpm spec`, `pnpm spec:validate`, second-stage authoring, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and wrapper-level `pnpm validate`; the only incomplete portion remains the expected local-terminal LibreOffice rerun.
- 2026-03-17: the current clean-root pass also reconfirmed the deterministic project loop with a new six-slide demo deck and no remaining overlap/out-of-bounds warnings in `pnpm build`.
- 2026-03-17: skill docs now explicitly warn second-stage consumers to use `slide_id`, `block_type`, and `asset_manifest.*`, which closes the clean-root contract-drift class observed during authoring.
- Acceptance bar retained: deterministic green plus one successful provider-backed temp-only live smoke.

## Idempotence and Recovery

- Deck-root and project refresh flows are safe to rerun.
- Prompt-driven spec runs are safe to rerun: pre-publish failures do not mutate canonical state; post-publish media failures remain recoverable by rerun.
- Live smoke is safe to rerun because it stays inside caller-owned temp output.
- Recovery path is artifact inspection plus rerun of the shared module, not manual patching.

## Decision Log

- 2026-03-15: the runtime contract is writer-first and always emits artifacts.
- 2026-03-15: the module stays stateless; callers own context discovery and output selection.
- 2026-03-15: phase 1 preserves stable canonical publish locations instead of redefining output layout.
- 2026-03-15: operator flow converges on one prompt-driven entrypoint with an explicit media-skip escape hatch only.
- 2026-03-16: validation and public integration boundaries remain package-owned, curated, and non-internal.
- 2026-03-16: artifact validation must always target outputs from the current build.
- 2026-03-16: live smoke remains explicit-project, temp-only, and phase-aware in failure normalization.
- 2026-03-16: the shared black box stops at canonical spec, generated media, and run artifacts; second-stage authoring of `src/buildDeck.ts`, `src/presentationModel.ts`, and tests remains skill-owned and may use content starters only as baseline references.

## Surprises and Discoveries

- Clearing the demo deck root after a previously green session is a meaningful regression probe because it exercises the bootstrap assumptions again instead of relying on stale workspace state.
- Remaining risk is provider/network instability, not local boundary wiring.
- The main drift class was systematic planner shape aliasing; prompt hardening fixed the current observed case.
- Live-smoke validation needed to decouple from real project-root assumptions.
- Failure classes still need to stay split between external/provider failure and contract/reporting failure.
- Minor docs/runtime state drift remains and should be treated as documentation cleanup, not hidden behavior.
- A clean-root operator rerun showed the second gap was not black-box ownership but skill-side contract clarity: the same session still needed a more explicit prompt -> black-box artifacts -> agent-authored content sequence.
- The validation wrapper originally wrote a header line that permanently said the PPTX was still pending even after a fresh artifact existed later in the same report; the template wording is now corrected, but the larger remaining workflow gap is still project-content authoring automation and better overlap-signal quality.
- A fresh end-to-end rerun exposed a contract drift in the shared black box: primary-success runs still skipped `candidate.fallback.json`, even though the execution plan says the artifact bundle is fixed on every `pnpm spec` / `pnpm spec:live` run.
- The same prompt can still produce different slide IDs, asset IDs, and step counts on a later provider-backed rerun, so second-stage project authoring must bind to `layout_intent` and `content_blocks` instead of assuming stable planner-generated identifiers.
- A brand-new demo deck root still needs one more real rerun after the latest doc/template changes so we can separate documentation drift from an actual operator-path failure.
- The fresh 2026-03-17 clean-root rerun exposed a narrower planner/runtime gap: the shared module could still reach semantic review with planner-supplied image prompt specs whose `avoid_elements` arrays were present but empty, which made the run fail even though the caller/bootstrap path was correct.
- The same rerun showed that raw planner `objectives` are not deck-facing copy. Rendering them directly in second-stage project content created avoidable layout collisions, so project authoring still needs deck-specific copy condensation rather than verbatim planner-note rendering.
- The same rerun also exposed an easy-to-miss second-stage consumer hazard: a fresh authoring pass breaks immediately if it guesses `slides[].id`, `block.type`, or a flat top-level `assets` array instead of consuming the exact canonical contract keys.

## Outcomes and Retrospective

- The shared module is now the implemented planner/validator/media boundary.
- The demo project is reduced to thin integration wrappers plus project content.
- The skill-side contract is now explicitly two-stage: black-box outputs first, agent-authored project content second, with no new generator added in this slice.
- Clean-root routing and metadata-contract docs are now aligned with the implemented workflow, and workspace plan governance is back on a single `PLANS.md` document instead of an accidentally restored legacy split.
- A final template-sync audit confirmed the demo deck no longer carries unrepatriated reusable changes; what remains there is intentionally deck-specific content and artifacts only.
- This migration slice is complete. Future work should start from project-content authoring automation, overlap-signal quality, or provider triage, not from boundary cleanup.
