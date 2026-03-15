# Execution Plan: Spec Workflow + Gemini Media Pipeline

This is a living execution plan for the canonical spec workflow and Gemini-backed media pipeline.
It is intended to be self-contained: an implementer should be able to start work from this file without reconstructing context from chat history.

Update this file during execution, not only before work starts.

## Context and Orientation

### Current repository state

- Workspace root: `/Volumes/BiGROG/skills-test`
- Current user-facing short-term plan source: `/Volumes/BiGROG/skills-test/ai-native-slides/MY-PLAN.md`
- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Current demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Development loop for this workspace: prove behavior in the demo project, then sync reusable changes back into the skill repo templates, scripts, and docs

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
5. `pnpm spec:generate -- --prompt "<prompt>"`
6. the same skill-owned session writes `tmp/spec-candidate.json`
7. `pnpm spec`
8. `pnpm spec:validate`
9. the same skill-owned session writes `tmp/spec-review-candidate.json`
10. `pnpm spec:review`
11. `pnpm media`
12. `pnpm build`
13. `pnpm validate`

Post-deliverable human review is intentionally outside this tracked operator path. If revision feedback arrives later, it is treated as a new prompt that re-enters step 1 for the targeted project, not as a mid-plan checkpoint.

The result must be:

- a canonical `spec/deck-spec.json`
- a canonical `spec/deck-spec.schema.json`
- a workflow-authored `tmp/planner-context.json`
- a workflow-authored `tmp/planner-brief.md`
- a promoted `tmp/spec-review.json`
- a promoted `output/spec-review.md`
- a semantic spec-review step that checks whether `spec/deck-spec.json` actually matches the user prompt
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

- [x] 2026-03-13 23:09 PDT: completed Milestone 1 and Milestone 2 foundations: shared-root runtime dependencies and scaffold convergence landed, `spec/deck-spec.schema.json` became the canonical contract, and the demo project passed `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [x] 2026-03-14 00:11 PDT: completed the first Milestone 3 slice: `pnpm spec` and `pnpm spec:review` promote fixed-path skill-authored candidates with deterministic validation, rollback, and scaffold/template synchronization, and the demo project plus bootstrap/ensure checks revalidated green.
- [x] 2026-03-14 02:23 PDT: completed the Milestone 4 core slice: `pnpm spec:generate` writes planner context/brief artifacts, `pnpm media` generates deterministic media from canonical spec inputs, workflow ownership of `source_prompt` moved into planner context, and both mocked tests plus a real Gemini-backed media run succeeded.
- [x] 2026-03-14 19:58 PDT: completed the semantic/planner hardening slice across Milestones 3 and 4: extracted stateless `src/planner-agent/` logic, added scorecards and review-coherence rules, expanded retry and handoff coverage, and kept `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` green.
- [x] 2026-03-14 23:56 PDT: completed Milestone 5 and Milestone 6 closure: the example deck became fully spec/media-driven, terminology was normalized from `plan/assets` to `spec/media`, docs and templates were aligned, and deterministic handoff coverage now extends through `spec:validate -> spec:review -> media -> build`.
- [x] 2026-03-15 00:17 PDT: completed the post-milestone metadata/reporting audit: scaffold metadata now validates `.ai-native-slides/project.json` against the canonical boundary, root/project state snapshots expose dirty skill revisions, and the live workspace revalidated with `ensure_deck_root.sh --json`, `ensure_deck_project.sh --json`, `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate`.
- [x] 2026-03-15 00:36 PDT: reran a live drift audit against code, templates, scaffold metadata, and runtime commands; found no material drift, reconfirmed that `pnpm validate` exits successfully with `INCOMPLETE (human-in-the-loop required)` inside Codex, and verified that local rerun commands plus raw `soffice` blocks are still printed.
- [ ] 2026-03-15 00:36 PDT: no additional milestone is active inside this plan; define a new milestone only if scope expands beyond v1 workflow stabilization, documentation maintenance, or drift audits.

## Plan of Work

### Current Milestone Status

- Milestone 1: Completed. Shared runtime, shared dependencies, and scaffold convergence are working in the demo workspace.
- Milestone 2: Completed. The canonical spec contract, naming rules, and structural validation boundary are implemented and tested.
- Milestone 3: Completed. Semantic review, fixed-path review artifacts, and candidate-promotion rollback/retry behavior are implemented.
- Milestone 4: Completed. Planner handoff artifacts and Gemini-backed media generation are implemented behind deterministic local commands.
- Milestone 5: Completed. The example project builds from canonical `spec/deck-spec.json` plus `media/generated-images/` and fails fast on missing required inputs.
- Milestone 6: Completed. User-facing and skill-facing docs match the implemented command flow and runtime boundaries.
- Current phase: post-v1 stabilization and drift auditing only.
- Remaining work in this plan: none beyond keeping docs, metadata, templates, and runtime behavior aligned. Any new product capability should start a new milestone.

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

- [x] Implement `pnpm spec` as promotion from `tmp/spec-candidate.json`
- [x] Implement `pnpm spec:generate` as workflow-authored `tmp/planner-context.json` + `tmp/planner-brief.md`
- [x] Make `source_prompt` workflow-managed through `tmp/planner-context.json`
- [x] Preserve legacy fallback to `candidate.source_prompt` with an explicit deprecation warning
- [x] Implement skill-native planner output targeting `tmp/spec-candidate.json`
- [x] Revalidate candidate output locally before write
- [x] Write `spec/deck-spec.json` atomically
- [x] Refuse to overwrite an existing valid `spec/deck-spec.json` with invalid output
- [x] Surface actionable errors for:
  - missing or invalid planner input
  - invalid JSON
  - schema-invalid output
  - unsupported or incomplete spec fields

### Semantic spec review

- [x] Implement `pnpm spec:review`
- [x] Compare `source_prompt` and `spec/deck-spec.json` using an agent-side semantic review step
- [x] Return structured outcomes such as `pass`, `warn`, and `fail`
- [x] Fail on major prompt drift, obviously missing required deliverables, or clearly mismatched slide/asset planning
- [x] Produce a review artifact that explains why the spec passed, warned, or failed
- [x] Promote `pass` and `warn` review outcomes into `spec/deck-spec.json.status = reviewed`
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
- [x] Update `FLOW.md`, `README.md`, and `references/project-workflow.md` to reflect prompt routing plus `spec -> spec:validate -> spec:review -> media -> build -> validate`
- [x] Update `SKILL.md` with Gemini workflow, env vars, and asset-storage rules
- [x] Ensure docs state clearly that `build` is deterministic and does not call Gemini
- [x] Add prompt guidance that tells operators when to say `create project <slug>` versus `revise project <slug>`

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

## Surprises and Discoveries

- 2026-03-13 to 2026-03-14: Fixed-path candidate artifacts were the practical first boundary because the repo-local CLI has no stable way to invoke Codex skill logic directly.
- 2026-03-13: Structural validation and semantic prompt alignment could not be merged; schema-valid JSON can still be off-prompt, so semantic review had to become a separate phase.
- 2026-03-14: Deterministic semantic tests required a stateless `src/planner-agent/` core rather than burying planner/reviewer logic inside workflow adapters.
- 2026-03-14: Once the example deck became spec/media-driven, top-level spec status alone was not enough; build also needed explicit required-file and per-asset status checks.
- 2026-03-14 to 2026-03-15: Terminology and metadata drift can survive in checked-in artifacts even when runtime code and tests are green, so completion audits must inspect tracked outputs and machine-readable metadata, not only source paths.
- 2026-03-13 to 2026-03-15: Toolchain details mattered more than expected: `sharp` required built-dependency handling, and shell helpers had to stay compatible with macOS Bash 3.2.
- 2026-03-15: Session routing and single-session ownership remain documentation-enforced. If stronger guarantees are needed later, that should become a new milestone rather than implicit scope creep.

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

### Retrospective notes

- v1 plan scope is operationally complete. Future product work should start from a new milestone instead of reopening closed slices as micro-entries.
- The main remaining gap is governance, not runtime implementation: session-routing and skill-ownership rules are documented and tested indirectly, but not enforced by a standalone CLI policy layer.

## References

- Google Gemini API quickstart: <https://ai.google.dev/gemini-api/docs/quickstart>
- Google Gemini image generation: <https://ai.google.dev/gemini-api/docs/image-generation>
