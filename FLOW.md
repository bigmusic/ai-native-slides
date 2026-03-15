# Validation Flow

## Workspace Roles

- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Reusable workflow changes should be proven in the demo project first, then synced back into the skill repo templates, scripts, and docs.
- For the current development loop, keep the concrete project name fixed at `ai-native-product-deck`.

## 0. Session Ownership

- One user prompt starts one skill-agent-owned end-to-end session.
- The first step in that session is prompt routing:
  - classify the prompt as `new_project` or `revise_existing_project`
  - prefer explicit wording such as `Create project <slug>` or `Revise project <slug>`
  - if the session is already scoped to one project, confirm the active project with `.ai-native-slides/project.json` and `.ai-native-slides/state.json`
  - for the current development loop, revision prompts default to `ai-native-product-deck` unless the user explicitly names another project or clearly asks for a fresh project
- Post-deliverable feedback is not a separate in-plan phase. It is a new prompt that re-enters this routing step.
- Within that same session, the skill agent is expected to:
  - resolve the target project before changing files
  - converge the deck root and project scaffold
  - run `pnpm spec -- --prompt "<prompt>"`
  - inspect the emitted debug and review artifacts when needed
  - generate media, author or revise deck source, and run validation-oriented commands
  - produce deliverables
- Deterministic CLI commands are guardrails inside that same skill session. They are not human approval checkpoints and not external-agent boundaries.
- Deliverables may be reviewed by humans only after they exist. Humans may inspect final artifacts, rerun local-terminal LibreOffice-backed validation when needed, and then send revision feedback as another prompt.

## 1. Deck Root Converge

- Run `scripts/ensure_deck_root.sh` first for preflight.
- If the root is incomplete, rerun `scripts/init_deck_root.sh`.
- This layer handles only shared runtime and shared config:
  `package.json`, `.npmrc`, `node_modules`, `.venv`, helpers, and root metadata.

## 2. Project Scaffold Converge

- If the routed intent is `new_project`, create or refresh the requested `projects/<slug>/` scaffold first.
- If the routed intent is `revise_existing_project`, operate in the named project. For the current development loop, the default revision target is `ai-native-product-deck`.
- Run `scripts/ensure_deck_project.sh <project-dir>` for preflight.
- If the scaffold is incomplete or template-managed files have drifted, rerun `scripts/init_deck_project.sh <deck-root> <project-slug>`.
- For the current development loop, the concrete example remains `scripts/init_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck ai-native-product-deck`.
- This layer handles only scaffold and metadata:
  `.gitignore`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `run-project.sh`, `validate-local.sh`, `src/main.ts`, and empty `spec/`, `media/`, `src/`, `tests/`, `output/`, and `tmp/` directories.

## 3. Spec And Semantic Review

- Use `pnpm spec -- --prompt "<prompt>"` as the main prompt-driven entrypoint.
- The CLI invokes the stateless deck-spec module, which calls the external planner model, normalizes the candidate, validates it, runs semantic review, and performs one internal repair retry before any canonical publish.
- On success, the command writes canonical `spec/deck-spec.json` with `status = reviewed`.
- On failure, the canonical target stays untouched and the CLI reports a stable failure kind derived from the module error.
- By default the command does not write candidate or review debug artifacts.

### 3.1 Optional Debug Surfaces

- `pnpm spec -- --prompt "<prompt>" --debug` writes `tmp/spec-candidate.json`, `tmp/spec-review.json`, `tmp/spec-diagnostics.json`, and `output/spec-review.md`.

### 3.2 Validate The Deck Spec Contract

- `spec/deck-spec.schema.json`, `src/deck-spec-module/*`, and `src/spec/*` are scaffold-managed files for the primary workflow.
- `spec/deck-spec.json` is canonical project input.
- Run `pnpm spec:validate` for structural validation.
- This step validates the contract only. It does not do semantic review and does not generate media.

## 4. Media Generation

- `pnpm media` processes only `required: true` `image_assets` and `shared_assets` from canonical `spec/deck-spec.json`.
- This is the only Gemini-dependent step in v1.
- It reruns structural validation at the same level as `pnpm spec:validate`, and requires `spec/deck-spec.json.status` to be `reviewed` or `media_ready`.
- `pnpm media` reads `GEMINI_API_KEY` only from the current shell or `<deck-root>/.env`; project-level `.env` files are out of scope in v1.
- Canonical outputs land at `media/generated-images/<output_file_name>`.
- Successful generation writes asset status back to `generated`. When all required image and shared assets exist, top-level `spec/deck-spec.json.status` becomes `media_ready`.
- Reruns may overwrite manifest-owned files, but v1 does not delete historical files automatically.

## 5. Deck Authoring And Build

- After planning and semantic review succeed, the same skill session owns deck authoring.
- The skill may create or revise:
  - `src/buildDeck.ts`
  - `src/presentationModel.ts`
  - project tests such as `tests/buildDeck.test.ts`
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before the session is considered complete for that prompt.
- `pnpm build` remains deterministic and offline. It should produce the deck from canonical spec data and local media.

## 6. Validate

- Fast loop:
  `pnpm spec`, `pnpm spec:validate`, `pnpm media`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Full validation:
  `pnpm validate`
- In Codex, LibreOffice-backed validation remains human-in-the-loop and may require a local-terminal rerun.
- If `pnpm validate` reports `INCOMPLETE (human-in-the-loop required)` only because LibreOffice-backed steps are blocked in Codex, that is a post-deliverable validation boundary. It does not reopen planning or semantic-review phases.

## 7. Post-Deliverable Feedback

- Once the session has produced final artifacts such as the built `.pptx`, source files, generated media, review markdown, and validation outputs, humans may review them outside this tracked workflow.
- Humans should not manually author or patch canonical or debug spec artifacts.
- Revision feedback should be phrased as a new prompt that says either `Revise project <slug>` for the existing deck or `Create project <slug>` for a fresh deck, then starts a new skill-agent-owned session from the latest artifacts and comments.

## Scope

- This flow is the user-facing workflow and validation basis.
- `repair`, `clean`, `migrate`, and `sync_to_codex` remain outside the normal delivery path.
