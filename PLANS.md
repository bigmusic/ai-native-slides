# Execution Plan: Spec Workflow + Gemini Media Pipeline

This is a living execution plan for the canonical spec workflow and Gemini-backed media pipeline.
It is intended to be self-contained: an implementer should be able to start work from this file without reconstructing context from chat history.

Update this file during execution, not only before work starts.

## Context and Orientation

### Current repository state

- Workspace root: `/Volumes/BiGROG/skills-test`
- Current user-facing short-term plan source: `/Volumes/BiGROG/skills-test/ai-native-slides/MY-PLAN.md`
- Skill repo project directory and active skill development directory: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Current demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Development loop for this workspace: prove behavior in the demo project, then sync reusable changes back into the skill repo project directory templates, scripts, docs, and other tracked implementation files

### Historical baseline confirmed on 2026-03-13

This section records the starting point before the 2026-03-14 workflow slices landed.
Current status is tracked in `Progress` and `Outcomes and Retrospective` below.

- `pnpm test` passes in the example project.
- `pnpm build` passes in the example project.
- The current example project still uses a hardcoded narrative model.
- The shared workflow at that point supported chat-artifact promotion through `plan`, `spec:validate`, and `spec:review`, plus `build`, `lint`, `typecheck`, `test`, and `validate`. The `assets` slice had not landed yet.
- Generated deck images are not yet part of the canonical project input flow.
- `assets/` is currently trackable project input, while `output/` is treated as generated output.

### Problem statement

The repository can scaffold and build slide decks, but it cannot yet:

- turn a user prompt into a validated canonical deck spec
- persist a semantic material inventory in one canonical JSON document
- generate small, medium, and large image assets from that spec
- make deck composition consume those generated media deterministically
- steer post-deliverable revision feedback back into the correct project as another end-to-end skill run

This execution plan closes that gap without making `pnpm build` depend on live network calls.

## Desired Outcome

After this plan is completed, the workflow must support the following operator path:

1. classify the user prompt as `new_project` or `revise_existing_project`
2. resolve the target project from explicit prompt wording first, then local project metadata if the session is already scoped to one project
3. if the prompt is `new_project`, initialize or refresh the requested `projects/<slug>/` scaffold
4. if the prompt is `revise_existing_project`, rerun the workflow in that project's directory
5. `pnpm spec -- --prompt "<prompt>"`
6. optional diagnostics only when explicitly needed: `pnpm spec -- --prompt "<prompt>" --debug`
7. `pnpm spec:validate`
8. `pnpm media`
9. `pnpm build`
10. `pnpm validate`

Post-deliverable human review is intentionally outside this tracked operator path. If revision feedback arrives later, it is treated as a new prompt that re-enters step 1 for the targeted project, not as a mid-plan checkpoint.

The result must be:

- a canonical `spec/deck-spec.json`
- a canonical `spec/deck-spec.schema.json`
- a stateless deck-spec module that owns external-model planning, canonicalization, structural validation, semantic review, and one internal repair retry
- optional debug artifacts under `tmp/` and `output/` only when `--debug` is explicitly requested
- a semantic `asset_manifest` embedded in `spec/deck-spec.json`
- generated deck-ready image assets under `media/generated-images/`
- a buildable PPT that intentionally composes those generated media
- a documented prompt guide that tells operators how to target an existing project or create a new one

## Deck Spec Ownership and Validation Boundary

`spec/deck-spec.json` is not a raw model transcript.
It is the canonical planning artifact produced from:

- planner-generated planning fields
- system-managed metadata and normalization
- local validation before downstream steps may consume it

### Planner-generated fields

The planner layer is responsible for producing the planning content, including:

- `target_slide_count`
- `slides`
- `asset_manifest`
- `slide_mapping`
- semantic planning fields such as:
  - `asset_label`
  - `title`
  - `objective`
  - `layout_intent`
  - `intended_usage`
  - `size_tier`
  - `style`
  - `subject`
  - `aspect_ratio`
  - `image_prompt_spec`

### System-managed fields

The local workflow is responsible for setting, normalizing, or enforcing fields such as:

- `plan_version`
- `generated_at`
- `project_slug`
- `source_prompt`
- top-level and per-asset `status`
- canonical `output_file_name` derived from deterministic naming rules, not directly from the raw prompt or the model's preferred phrasing
- optional provider-specific prompt text compiled from planner-owned semantic fields
- any normalized defaults required to satisfy the schema contract

### Validation boundary

The validator must distinguish between what can be verified mechanically and what cannot.

The validator must enforce:

- JSON shape and required fields
- enum membership such as `size_tier`, `layout_intent`, `output_format`, and `status`
- string presence and non-empty required values
- stable semantic naming rules for generated filenames and machine-facing keys
- referential integrity:
  - `slide_mapping` only references declared slides and assets
  - required assets have stable ids
  - asset ids are unique
- bounded structural rules such as:
  - each slide has at least one planning objective
  - each required image asset declares intended usage and size tier
  - each required image asset declares enough semantic prompt-spec fields for provider prompt compilation
  - output filenames match the declared format
  - `output_file_name` is system-derived and stable for the same canonical asset identity

The validator must not claim to prove:

- whether a slide count is truly the best one for the prompt
- whether `style`, `subject`, or `objective` are semantically correct
- whether `image_prompt_spec` will definitely produce a good image
- whether image prompts are aesthetically strong
- whether the final narrative is persuasive
- whether generated images are actually good enough for presentation use

These non-verifiable semantic qualities require either:

- human review
- an agent review step that compares the prompt and the generated spec
- downstream quality heuristics
- future evaluation systems outside the strict schema validator

## Progress

- [x] 2026-03-15 10:47 PDT: clarified workspace directory roles at the top of this plan after confirming that `ai-native-slides/` is the only git-backed directory under `/Volumes/BiGROG/skills-test`; the plan now states explicitly that this git-backed skill repo directory is also the active skill development directory and that reusable changes must be synced back there before work is complete.
- [x] 2026-03-13 23:09 PDT: completed Milestone 1 and Milestone 2 foundations: shared-root runtime dependencies and scaffold convergence landed, `spec/deck-spec.schema.json` became the canonical contract, and the demo project passed `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [x] 2026-03-14 00:11 PDT: completed the first Milestone 3 slice: `pnpm spec` and `pnpm spec:review` promote fixed-path skill-authored candidates with deterministic validation, rollback, and scaffold/template synchronization, and the demo project plus bootstrap/ensure checks revalidated green.
- [x] 2026-03-14 02:23 PDT: completed the Milestone 4 core slice: `pnpm spec:generate` writes planner context/brief artifacts, `pnpm media` generates deterministic media from canonical spec inputs, workflow ownership of `source_prompt` moved into planner context, and both mocked tests plus a real Gemini-backed media run succeeded.
- [x] 2026-03-14 19:58 PDT: completed the semantic/planner hardening slice across Milestones 3 and 4: extracted stateless `src/planner-agent/` logic, added scorecards and review-coherence rules, expanded retry and handoff coverage, and kept `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` green.
- [x] 2026-03-14 23:56 PDT: completed Milestone 5 and Milestone 6 closure: the example deck became fully spec/media-driven, terminology was normalized from `plan/assets` to `spec/media`, docs and templates were aligned, and deterministic handoff coverage now extends through `spec:validate -> spec:review -> media -> build`.
- [x] 2026-03-15 00:17 PDT: completed the post-milestone metadata/reporting audit: scaffold metadata now validates `.ai-native-slides/project.json` against the canonical boundary, root/project state snapshots expose dirty skill revisions, and the live workspace revalidated with `ensure_deck_root.sh --json`, `ensure_deck_project.sh --json`, `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate`.
- [x] 2026-03-15 00:36 PDT: reran a live drift audit against code, templates, scaffold metadata, and runtime commands; found no material drift, reconfirmed that `pnpm validate` exits successfully with `INCOMPLETE (human-in-the-loop required)` inside Codex, and verified that local rerun commands plus raw `soffice` blocks are still printed.
- [x] 2026-03-15 01:13 PDT: started Milestone 7 by defining the planner as a skill-internal but independently developable stateless module with explicit input/output contracts, so the next refactor slice could narrow planner responsibilities without pretending the planner was already a standalone product or runtime.
- [x] 2026-03-15 02:24 PDT: completed the first Milestone 7 implementation slice: added `src/deck-spec-module/public-api.ts`, moved prompt-to-canonical-spec planning and deterministic semantic review inside the stateless module, changed `pnpm spec -- --prompt "<prompt>"` into the primary prompt-driven publish path, kept `spec:generate` and `spec:review` as debug/compat surfaces, synced reusable template changes, and revalidated with `pnpm test` plus `pnpm typecheck`.
- [x] 2026-03-15 02:29 PDT: recorded the follow-up steering decision that semantic review belongs inside the stateless deck-spec module, not as a workflow-owned external evaluator; docs and implementation now align on module-internal review plus workflow-owned publish/I/O only.
- [x] 2026-03-15 03:18 PDT: reran a completion audit for the planner-core purification slice against the live demo project. `pnpm typecheck`, `pnpm test`, `pnpm spec:validate`, and `pnpm build` passed, but `pnpm lint` and therefore `pnpm validate` failed; the audit also confirmed that the prompt-driven CLI still imports the module's internal detailed planner entry and that legacy `spec:generate` / `spec:review` promotion language remains in tests and planning documents.
- [x] 2026-03-15 03:33 PDT: completed the Milestone 7 boundary-cleanup pass: the prompt-driven CLI now routes through the public `planDeckSpecFromPrompt` surface with a debug hook instead of importing the internal detailed planner entry, compatibility commands emit explicit deprecation warnings, the main workflow integration test now covers `spec -> media -> build`, and the live demo project revalidated with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm spec:validate`, `pnpm build`, and `pnpm validate` returning the expected Codex `human-in-the-loop` incomplete state rather than a hard failure.
- [x] 2026-03-15 09:37 PDT: completed the follow-up purification cleanup pass: `pnpm spec` was split into a thin prompt-driven wrapper plus an isolated legacy compatibility module, planner API-key resolution now accepts shell-provided credentials without requiring deck-root discovery, prompt-workflow tests now assert that normal runs do not emit compatibility handoff artifacts, and the current docs/plans mark `spec:generate` / `spec:review` and `skill_handoff` metadata as transition-only surfaces rather than primary workflow contract.
- [x] 2026-03-15 09:42 PDT: synced the purified project changes back into `ai-native-slides/assets/templates/`, reran project preflight to clear template drift warnings, and revalidated the demo project with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm spec:validate`, `pnpm build`, and `pnpm validate`, with `pnpm validate` again ending in the expected Codex `INCOMPLETE (human-in-the-loop required)` state instead of a scaffold failure.
- [x] 2026-03-15 09:55 PDT: resumed the planner-core purification audit after a live Gemini planning check exposed a remaining boundary bug: malformed model output could fail structural validation and still reach semantic review, causing a runtime crash instead of a typed contract error. The fix hardens the module to stop review on validation failure, adds a canonical JSON shape example plus key-name constraints to the planner prompt, syncs the reusable template copies, and adds regression coverage for malformed candidate output.
- [x] 2026-03-15 10:03 PDT: revalidated the hardened slice with `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm spec:validate`, `pnpm build`, and `pnpm validate`. The deterministic suite stayed green, `pnpm validate` again ended in the expected Codex `INCOMPLETE (human-in-the-loop required)` state, and live Gemini smoke checks no longer reproduced the malformed-output crash; remaining live failures were intermittent provider-layer `fetch failed` responses before any planning attempt diagnostics existed.
- [x] 2026-03-15 10:08 PDT: switched the planner default model id from `gemini-2.5-flash` to `gemini-3-flash-preview` in both the demo project and the template copy so prompt-driven planning uses the new preview model unless an explicit override is passed.
- [x] 2026-03-15 10:10 PDT: added a dedicated Gemini planner `systemInstruction` so JSON-format stability no longer relies only on the user-prompt body. The new system prompt is intentionally short and strict: one JSON object only, no prose/markdown/aliases/null placeholders, and schema compliance prioritized over stylistic variation.
- [x] 2026-03-15 10:15 PDT: reran a full completion audit for the planner-core purification slice. `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed in the demo project, and `pnpm validate` again stopped at the documented Codex human-in-the-loop boundary. The audit also confirmed residual terminology drift: the prompt-driven `pnpm spec` CLI still prints `promotion` language, and compatibility/template planner-agent surfaces still describe candidate-promotion workflows even though they are no longer the primary contract.
- [x] 2026-03-15 10:31 PDT: completed the boundary-language cleanup follow-on. The prompt-driven CLI now resolves Gemini credentials outside the module and no longer exposes `promotion` wording on the happy path, `planDeckSpecFromPrompt` no longer performs deck-root `.env` filesystem lookup, module-owned review/media types were pulled under `src/deck-spec-module/`, and both demo-project plus template `planner-agent` surfaces now present candidate/review authoring as explicit legacy compatibility flows. Revalidated with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm spec:validate`, `pnpm build`, and `pnpm validate`, with `pnpm validate` again ending at the expected Codex human-in-the-loop boundary.

## Plan of Work

### Current Milestone Status

- Milestone 1: Completed. Shared runtime, shared dependencies, and scaffold convergence are working in the demo workspace.
- Milestone 2: Completed. The canonical spec contract, naming rules, and structural validation boundary are implemented and tested.
- Milestone 3: Completed. Semantic review, fixed-path review artifacts, and candidate-promotion rollback/retry behavior are implemented.
- Milestone 4: Completed. Planner handoff artifacts and Gemini-backed media generation are implemented behind deterministic local commands.
- Milestone 5: Completed. The example project builds from canonical `spec/deck-spec.json` plus `media/generated-images/` and fails fast on missing required inputs.
- Milestone 6: Completed. User-facing and skill-facing docs match the implemented command flow and runtime boundaries.
- Milestone 7: Completed for the primary contract. The stateless deck-spec module boundary is implemented, the prompt-driven CLI is thin on the happy path, module planning no longer performs deck-root filesystem lookup, and compatibility surfaces are now explicitly legacy-only.
- Current phase: Post-cleanup validation and optional legacy-field simplification only.
- Remaining work in this plan: optional debt cleanup only, such as renaming residual legacy field names like `promotion_command` inside deprecated compatibility contracts if we decide that extra churn is worth it.

### Milestone 1: Shared runtime and workflow foundations

Add the root dependencies and scaffold-managed workflow files required to support spec generation, schema validation, environment loading, Gemini client access, and image optimization.

Success condition:

- the demo project `ai-native-product-deck` can expose `spec`, `spec:validate`, `spec:review`, and `media` commands without manual file copying

Validation:

- root preflight passes after dependency install
- project preflight still recognizes template-managed boundaries correctly

### Milestone 2: Canonical spec contract

Create one canonical schema and one canonical spec file naming policy so planner output, local validation, tests, and downstream deck composition all share the same contract.

Success condition:

- `spec/deck-spec.schema.json` is the only schema source of truth
- `pnpm spec:validate` can reject malformed plans with actionable errors
- the implementation clearly separates planner-generated planning fields from system-managed metadata and normalization fields
- the validator only enforces structural and rule-based guarantees, not unprovable semantic quality claims
- dynamic prompt wording does not directly control canonical filesystem filenames
- provider-specific image prompt strings are compiled by the system from planner-owned semantic prompt specs

Validation:

- unit tests cover schema acceptance and rejection cases
- tests and docs agree on which fields are planner-generated and which are system-managed

### Milestone 3: Semantic spec review

Add a separate semantic eval step so the agent checks whether `spec/deck-spec.json` is actually aligned with the user prompt before downstream image generation begins.

Success condition:

- `spec:review` compares `source_prompt` and `spec/deck-spec.json` without pretending to be a hard schema validator
- the review can fail on obvious prompt drift, missing major requirements, or obviously mismatched asset planning
- media generation does not proceed on a failed semantic review

Validation:

- the semantic review contract is documented separately from schema validation
- tests cover pass, warn, and fail outcomes using mocked review results

### Milestone 4: Planning and Gemini-backed media generation

Implement a two-step AI pipeline:

- prompt -> structured `spec/deck-spec.json` through the planner layer
- `image_assets[]` -> generated and optimized files

This milestone must keep network activity out of `build`.

Success condition:

- `media` is the only Gemini-dependent command in v1
- `spec` promotes a canonical deck spec through the planner layer without assigning spec ownership to Gemini
- invalid planner output cannot corrupt an existing valid spec

Validation:

- integration tests use mocked planner and Gemini adapters
- manual run with a real Gemini image-generation API key succeeds

### Milestone 5: Deck composition from canonical inputs

Replace the example project's hardcoded content path with a spec-driven, media-driven build path.

Success condition:

- `build` consumes `spec/deck-spec.json` and `media/generated-images/`
- missing required inputs fail fast and clearly

Validation:

- example-project tests stay green offline
- generated PPT remains non-empty and uses expected media

### Milestone 6: Documentation and operational alignment

Update user-facing and skill-facing docs so they describe the new workflow, new command boundaries, required environment variables, and the canonical naming rules.

Success condition:

- docs do not imply that `build` calls Gemini
- docs reflect the same file names and command flow used in code
- docs describe session-start prompt routing for `new_project` versus `revise_existing_project`

Validation:

- manual doc pass confirms no contradictions across `MY-PLAN.md`, `FLOW.md`, `README.md`, `SKILL.md`, and `references/project-workflow.md`

### Milestone 7: Stateless planner module boundary

Define the planner as a skill-internal module that can be developed and tested independently, without claiming that it is already a standalone runtime or that it can replace the skill agent's orchestration role.

Success condition:

- one planner input contract is documented and bounded, including prompt-derived requirements, existing-project context, renderer constraints, and the workflow-managed fields the planner may read
- one planner output contract is documented and bounded, including candidate-spec content, review handoff prerequisites, and retry/error surfaces the skill layer consumes
- planner logic is made stateless at the module boundary: pure computation stays inside the planner module, while filesystem writes, CLI wiring, and session orchestration stay outside it
- the repository keeps the current skill-owned workflow model; this milestone does not introduce a fake standalone planner service or bypass the skill agent

Validation:

- docs identify the deck-spec module's inputs, outputs, non-goals, and remaining skill-owned responsibilities
- contract or unit tests cover deterministic planner-boundary transforms without relying on hidden mutable state
- the current prompt-driven `spec -- --prompt` workflow, plus the downgraded `spec:generate` / `spec:review` compatibility surfaces, stay documented and test-covered

## Concrete Steps

### Shared runtime and scaffold

- [x] Add `@google/genai`, `ajv`, and `sharp` to the shared root runtime templates
- [x] Update `pnpm.onlyBuiltDependencies` to include `sharp`
- [x] Update root bootstrap/install checks so the new dependencies are treated as required
- [x] Update root ensure/preflight logic to verify the new dependencies
- [x] Extend project template `package.json` with `spec`, `spec:validate`, `spec:review`, and `media`
- [x] Extend `run-project.sh` so it accepts the new actions and forwards extra CLI args
- [x] Add scaffold-managed TS modules for:
  - environment variable resolution
  - deck spec path resolution
  - schema validation
  - semantic spec review
  - planner interfaces
  - Gemini image adapter
  - asset naming
  - image optimization
- [x] Add scaffold-managed TS modules for:
  - planner brief generation
  - planner context ownership/validation
  - shared renderer-contract reuse between validation and planner brief generation

### Canonical contract

- [x] Add `spec/deck-spec.schema.json`
- [x] Define semantic `snake_case` JSON keys and semantic generated artifact filenames
- [x] Define and document the ownership boundary between:
  - planner-generated planning fields
  - system-managed metadata and normalization fields
- [x] Define the canonical top-level structure:
  - `plan_version`
  - `generated_at`
  - `project_slug`
  - `source_prompt`
  - `target_slide_count`
  - `slides`
  - `asset_manifest`
  - `slide_mapping`
  - `status`
- [x] Define `asset_manifest` substructures:
  - `text_assets`
  - `image_assets`
  - `shared_assets`
- [x] Define `image_assets[]` required fields:
  - `asset_id`
  - `asset_label`
  - `slide_id` or shared scope
  - `intended_usage`
  - `size_tier`
  - `style`
  - `subject`
  - `aspect_ratio`
  - `image_prompt_spec`
  - `output_format`
  - `required`
  - `output_file_name`
  - `status`
- [x] Define filename ownership policy:
  - `asset_label` is planner-generated and human-meaningful
  - `output_file_name` is system-managed and deterministic
  - the system may canonicalize semantic hints, but the planner does not own final filename selection
- [x] Define image prompt ownership policy:
  - `image_prompt_spec` is planner-generated and provider-agnostic
  - provider-specific prompt text is system-generated
  - Gemini is an image provider and does not own prompt-writing
- [x] Define bounded `layout_intent` values:
  - `hero`
  - `split_visual`
  - `cards`
  - `metrics`
  - `timeline`
  - `closing`
- [x] Define validator scope explicitly:
  - schema and referential integrity checks are hard validation
  - semantic quality and prompt appropriateness are outside strict validator guarantees

### Prompt-to-spec pipeline

- [x] Implement `pnpm spec -- --prompt "<prompt>"` as the thin publish wrapper around the stateless deck-spec module
- [x] Move prompt interpretation, external-model planning, canonicalization, structural validation, semantic review, and one internal repair retry into `src/deck-spec-module/`
- [x] Keep successful prompt-driven runs side-effect-free inside the module and limit filesystem writes to the CLI adapter
- [x] Emit `tmp/spec-candidate.json`, `tmp/spec-review.json`, `tmp/spec-diagnostics.json`, and `output/spec-review.md` only when `--debug` is explicitly requested
- [x] Preserve the legacy no-`--prompt` candidate-promotion path only as a deprecated compatibility surface
- [x] Preserve legacy fallback to `candidate.source_prompt` with an explicit deprecation warning
- [x] Write `spec/deck-spec.json` atomically
- [x] Refuse to overwrite an existing valid `spec/deck-spec.json` with invalid output
- [x] Prevent malformed planner output from entering semantic review after structural validation has already failed
- [x] Surface actionable errors for:
  - invalid or underspecified prompt input
  - planner/model failures
  - canonical contract validation failures
  - semantic review failures after the internal repair attempt

### Semantic spec review

- [x] Keep semantic review inside the stateless deck-spec module rather than as a workflow-owned phase
- [x] Fail on major prompt drift, obviously missing required deliverables, or clearly mismatched slide/asset planning
- [x] Return stable typed module errors plus structured diagnostics for failed review or validation attempts
- [x] Mark successful prompt-driven specs as `reviewed` before publish
- [x] Keep `pnpm spec:review` available only as a deprecated compatibility/debug command for explicit review-candidate workflows
- [x] Gate `pnpm media` so it does not proceed after a failed semantic review unless an explicit override mode is added later

### Image generation and optimization

- [x] Implement `pnpm media`
- [x] Read required `image_assets` from `spec/deck-spec.json`
- [x] Compile provider-specific image prompt text from planner-owned `image_prompt_spec`
- [x] Generate images through a thin Gemini image adapter that can be mocked in tests
- [x] Write deck-ready images into `media/generated-images/`
- [x] Apply deterministic size-tier optimization:
  - `small`: max long edge `512px`
  - `medium`: max long edge `1024px`
  - `large`: cap to `1920x1200`
- [x] Respect schema-level `output_format` overrides
- [x] Do not auto-delete stale generated files in v1

### Example project refactor

- [x] Refactor `presentationModel.ts` to load and normalize `spec/deck-spec.json`
- [x] Refactor `buildDeck.ts` to render from spec data plus generated media
- [x] Keep overlap and out-of-bounds warnings enabled
- [x] Check in offline fixture inputs:
  - representative `spec/deck-spec.json`
  - matching generated-image fixtures
- [x] Map `large`, `medium`, and `small` assets to intended slide layouts

### Documentation

- [x] Update `MY-PLAN.md` if any command or file contract changed during implementation
- [x] Update `FLOW.md`, `README.md`, and `references/project-workflow.md` to reflect prompt routing plus `spec -> spec:validate -> media -> build -> validate`, while keeping `spec:generate` / `spec:review` documented only as transition compatibility surfaces
- [x] Update `SKILL.md` with Gemini workflow, env vars, and asset-storage rules
- [x] Ensure docs state clearly that `build` is deterministic and does not call Gemini
- [x] Add prompt guidance that tells operators when to say `create project <slug>` versus `revise project <slug>`

### Planner module boundary hardening

- [x] Define the planner boundary as skill-internal infrastructure, not as a standalone external runtime
- [x] Document the exact planner input contract, including prompt requirements, project context, renderer constraints, and workflow-managed fields
- [x] Document the exact planner output contract, including candidate-spec content, review-handoff prerequisites, and retryable failure surfaces
- [x] Separate pure planner transforms from filesystem I/O, CLI plumbing, and session orchestration
- [x] Audit the current `src/planner-agent/*` and `src/spec/*` split against that target boundary and record the remaining mixed-responsibility seams
- [x] Add or tighten deterministic contract tests around planner input/output serialization and stateless behavior
- [x] Preserve the current skill-agent-owned workflow while doing this slice; do not introduce a fake standalone planner runtime

## Validation and Acceptance

### Deterministic tests to write first

- [x] Schema validation accepts valid plans
- [x] Schema validation rejects malformed plans with clear errors
- [x] Validator rejects broken slide-to-asset references and duplicate asset ids
- [x] Asset filename derivation is semantic and stable
- [x] Identical canonical asset identities produce stable `output_file_name` values even if prompt wording changes
- [x] Size-tier to dimension mapping is deterministic
- [x] Requested output formats remain deterministic across representative size tiers
- [x] Environment variable resolution fails clearly when Gemini image-generation API keys are missing
- [x] Build preflight fails when required generated media are missing
- [x] System-managed fields are normalized consistently after planner output is accepted
- [x] Provider-specific image prompt compilation is deterministic for the same `image_prompt_spec`
- [x] `spec:generate` writes planner context and brief artifacts without mutating canonical spec files
- [x] Promotion can succeed when the candidate omits `source_prompt` and a valid planner context exists
- [x] Promotion rejects invalid planner-context files without overwriting an existing valid canonical spec
- [x] Legacy candidate `source_prompt` fallback emits a deprecation warning
- [x] Semantic review distinguishes structural validity from prompt alignment validity
- [x] Semantic review fails when the spec omits a major prompt requirement even if the schema is valid
- [x] Malformed planner output that omits required nested fields fails as `contract_validation_failed` instead of a runtime exception

### Integration tests

- [x] `spec:generate -> spec -> spec:validate` succeeds for a temp project with a deterministic candidate handoff
- [x] `spec:generate` writes deterministic planner context/brief artifacts from `--prompt`
- [x] `spec` preserves the previous valid spec when new planner output is invalid
- [x] `spec:review` returns `pass`, `warn`, or `fail` for mocked semantic-review scenarios
- [x] `media` refuses to proceed after a failed semantic review
- [x] `media` compiles provider-specific image prompt text from `image_prompt_spec` without calling a text-generation model
- [x] `media` generates expected filenames and optimized outputs from a manifest
- [x] `build` consumes canonical spec + media without triggering Gemini

### Example project regression

- [x] `pnpm test` stays green offline
- [x] `pnpm build` stays green offline
- [x] generated PPT remains non-empty
- [x] tests verify required media generation and canonical asset writeback

### Manual acceptance with real image-generation credentials

- [x] `pnpm spec:generate -- --prompt "<prompt>"`
- [x] `spec:generate -> spec -> spec:validate` smoke run against a temp project seeded from the example fixture
- [x] `pnpm spec:validate`
- [x] `pnpm spec:review`
- [x] `pnpm media`
- [x] `pnpm build`
- [x] confirm by artifact inspection that the built PPTX embeds the planned visual media on slides that reference image blocks
- [x] confirm that a fail semantic-review artifact can record an obviously off-prompt requirement miss and keep `pnpm media` gated
- [x] confirm that planner-owned prompt specs compile into usable provider prompts without a separate text-generation step
- [x] confirm the active workflow docs explain that post-deliverable feedback should be phrased as either `create project <slug>` or `revise project <slug>` and re-enter the same end-to-end flow from session start

## Idempotence and Recovery

- `pnpm build` must remain deterministic and offline once `spec/deck-spec.json` and required media files already exist.
- `pnpm spec` must never replace a valid existing spec with invalid planner output.
- `pnpm spec:review` must be rerunnable and non-destructive; it evaluates the current spec and writes review state without mutating canonical spec content.
- `pnpm media` may overwrite files that are explicitly referenced by the current manifest, but must not delete unrelated historical files in v1.
- Re-running root bootstrap or project scaffold refresh must remain safe and idempotent.
- If Gemini generation fails partway through:
  - keep already valid files
  - report which assets failed
  - allow a rerun of `pnpm media` without manual cleanup
- If schema validation fails:
  - no spec file write occurs
  - the operator can fix the prompt and rerun `pnpm spec`
- If semantic review fails:
  - the existing `spec/deck-spec.json` remains unchanged
  - the operator can revise the prompt, regenerate the spec, or inspect the review artifact before retrying

## Decision Log

- 2026-03-15 10:47 PDT: treat `/Volumes/BiGROG/skills-test/ai-native-slides` as the authoritative git-backed skill repo project directory for this workstream. Demo-project validation may happen under `ai-education-deck`, but reusable changes are not done until they are synced back into `ai-native-slides`.
- 2026-03-13 to 2026-03-15: Scope is the shared workflow plus the example project. Prove reusable behavior in the demo project first, then sync templates, scripts, and docs back into the skill repo.
- 2026-03-13: Canonical runtime surfaces are `spec/deck-spec.json`, `spec/deck-spec.schema.json`, and `media/generated-images/`; `build` stays deterministic/offline and never calls Gemini.
- 2026-03-13 to 2026-03-14: `spec/deck-spec.json` is a canonical planner-owned artifact with system-managed normalization; strict validation guarantees structure, naming, and referential integrity only, not semantic quality.
- 2026-03-14: `pnpm spec:generate` is a deterministic handoff writer, not a model caller; v1 planner and review candidates remain fixed-path skill-authored artifacts.
- 2026-03-14: `pnpm spec` is the fail-fast canonical write boundary, emits stable failure kinds, and allows exactly one skill-managed retry only for invalid candidate JSON or candidate validation failures.
- 2026-03-14: `spec:review` is a separate semantic-review phase; `pass`, `warn`, and `fail` must stay evidence-coherent and gate downstream `media`.
- 2026-03-13 to 2026-03-14: Gemini is reserved for image generation during `pnpm media`; planner-owned `image_prompt_spec` is compiled into provider prompts by the system, and `GEMINI_API_KEY` comes from the shell or `<deck-root>/.env`.
- 2026-03-14: The example project must build only from canonical spec plus generated media, and renderer compatibility must fail fast at `pnpm spec:validate` rather than being deferred to `pnpm build`.
- 2026-03-14: User workflow is one skill-agent-owned session per prompt with `new_project` / `revise_existing_project` routing; this remains a skill/docs contract rather than a standalone CLI runtime policy.
- 2026-03-15: Machine-readable metadata and dirty-worktree state are part of scaffold convergence, not optional reporting.
- 2026-03-15: The next refactor target is not full planner extraction; it is a tighter planner module boundary with explicit input/output contracts and stateless internals, while the skill agent continues to own orchestration.
- 2026-03-15 02:29 PDT: user steering clarified that semantic review must stay inside the stateless deck-spec module rather than becoming a workflow-external evaluator, because splitting review back into workflow logic would blur the module boundary and weaken the intended purity of the stateless contract.

## Surprises and Discoveries

- 2026-03-13 to 2026-03-14: Fixed-path candidate artifacts were the practical first boundary because the repo-local CLI has no stable way to invoke Codex skill logic directly.
- 2026-03-13: Structural validation and semantic prompt alignment could not be merged; schema-valid JSON can still be off-prompt, so semantic review had to become a separate phase.
- 2026-03-14: Deterministic semantic tests required a stateless `src/planner-agent/` core rather than burying planner/reviewer logic inside workflow adapters.
- 2026-03-14: Once the example deck became spec/media-driven, top-level spec status alone was not enough; build also needed explicit required-file and per-asset status checks.
- 2026-03-14 to 2026-03-15: Terminology and metadata drift can survive in checked-in artifacts even when runtime code and tests are green, so completion audits must inspect tracked outputs and machine-readable metadata, not only source paths.
- 2026-03-13 to 2026-03-15: Toolchain details mattered more than expected: `sharp` required built-dependency handling, and shell helpers had to stay compatible with macOS Bash 3.2.
- 2026-03-15: Session routing and single-session ownership remain documentation-enforced. If stronger guarantees are needed later, that should become a new milestone rather than implicit scope creep.
- 2026-03-15 02:29 PDT: the first Milestone 7 draft briefly pushed semantic review out into workflow territory. That split looked architecturally cleaner on paper but violated the stronger stateless-module goal once the user clarified that review is part of the same pure prompt-to-spec contract slice.
- 2026-03-15 09:42 PDT: after the boundary cleanup landed in the demo project, `pnpm validate` briefly regressed for an uninteresting reason: template-managed files in `assets/templates/` had not yet been updated, so project preflight failed before any render validation started. The fix was template sync, not product-code rollback.
- 2026-03-15 10:03 PDT: live Gemini validation split into two distinct classes of failures. The malformed-candidate runtime crash was fixed by stopping semantic review after structural validation failure, but the provider call itself still shows intermittent `fetch failed` errors that surface as `planning_failed` before any planner-attempt diagnostics are recorded.
- 2026-03-15 10:15 PDT: a green local validation matrix is not enough to declare the purification slice fully complete. The runtime boundary now works as intended, but checked-in compatibility/template paths can still carry obsolete `promotion` and `planner-agent` language that weakens the new contract if we leave them undocumented.
- 2026-03-15 10:31 PDT: the strongest purity leak turned out not to be wording but hidden I/O. The prompt-driven module path was still reaching into deck-root `.env` lookup until the CLI took back credential resolution and passed the API key into the module explicitly.

## Outcomes and Retrospective

### Completed outcomes

- 2026-03-13 to 2026-03-15: Shared runtime, scaffold convergence, and repo-local execution protocol are in place across the demo deck root and project.
- 2026-03-13 to 2026-03-14: The canonical spec contract, stable filename policy, planner/system field ownership, and structural validation boundary are implemented and covered by deterministic tests.
- 2026-03-14: `pnpm spec:generate`, `pnpm spec`, and `pnpm spec:review` now form a deterministic fixed-path handoff with rollback, retry diagnostics, review artifacts, and scaffold/template sync.
- 2026-03-14: `pnpm media` is the only Gemini-dependent step, writes deck-ready files into `media/generated-images/`, preserves historical files in v1, and advances canonical status to `media_ready` when required assets exist.
- 2026-03-14: The example project now builds from canonical spec plus generated media, the checked-in fixture covers the full current layout enum, and offline `pnpm test` / `pnpm build` remain green.
- 2026-03-14: `FLOW.md`, `MY-PLAN.md`, `README.md`, `SKILL.md`, and `references/project-workflow.md` now agree on prompt routing, command order, and the deterministic/offline build boundary.
- 2026-03-15: Metadata/reporting convergence was tightened so `.ai-native-slides/project.json` is validated against the canonical boundary and root/project state files expose dirty skill revisions.
- 2026-03-15: The latest live audit found no material drift; `ensure_deck_root.sh --json`, `ensure_deck_project.sh --json`, `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate` all matched the documented behavior, with `pnpm validate` remaining human-in-the-loop only for LibreOffice-backed steps inside Codex.
- 2026-03-15 09:42 PDT: the planner-core purification cleanup now stays aligned across demo project code, skill templates, docs, and preflight metadata; the remaining gap is live external-planner success verification, not local contract drift.
- 2026-03-15 10:15 PDT: the runtime contract is locally validated, but the completion audit still found residual boundary-language drift. The remaining work is cleanup, not architecture: remove obsolete `promotion`/`planner-agent` wording from prompt-driven surfaces and compatibility scaffolding so the written contract matches the implemented one.
- 2026-03-15 10:31 PDT: the primary runtime boundary and wording cleanup are now aligned. Remaining drift is intentionally fenced into deprecated compatibility metadata rather than leaking through the prompt-driven happy path or through module-internal imports.

### Retrospective notes

- v1 runtime scope and primary boundary cleanup are operationally complete. Any further churn should be judged as optional legacy-surface simplification rather than as a blocker on the module-purification slice.
- The main remaining gap is governance, not runtime implementation: session-routing and skill-ownership rules are documented and tested indirectly, but not enforced by a standalone CLI policy layer.

## References

- Google Gemini API quickstart: <https://ai.google.dev/gemini-api/docs/quickstart>
- Google Gemini image generation: <https://ai.google.dev/gemini-api/docs/image-generation>
