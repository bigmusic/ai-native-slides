#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <project-dir> [--quiet] [--json]" >&2
}

QUIET=0
JSON_ONLY=0
PROJECT_DIR=""

for arg in "$@"; do
  case "$arg" in
    --quiet)
      QUIET=1
      ;;
    --json)
      JSON_ONLY=1
      ;;
    -*)
      usage
      exit 1
      ;;
    *)
      if [[ -n "$PROJECT_DIR" ]]; then
        usage
        exit 1
      fi
      PROJECT_DIR="$arg"
      ;;
  esac
done

if [[ -z "$PROJECT_DIR" ]]; then
  usage
  exit 1
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

assert_not_project_root "$PROJECT_DIR" "$SCRIPT_DIR"

DECK_ROOT="$(find_deck_root_for_project "$PROJECT_DIR" || true)"
if [[ -z "$DECK_ROOT" ]]; then
  DECK_ROOT="$(infer_deck_root_from_project_dir "$PROJECT_DIR" || true)"
fi

STATE_DIR="${PROJECT_DIR}/.ai-native-slides"
STATE_FILE="${STATE_DIR}/state.json"
PROJECT_METADATA_FILE="$(project_metadata_path "$PROJECT_DIR")"
PROJECT_GITIGNORE="${PROJECT_DIR}/.gitignore"
DECK_SPEC_SCHEMA="${PROJECT_DIR}/spec/deck-spec.schema.json"
PACKAGE_JSON="${PROJECT_DIR}/package.json"
TSCONFIG_JSON="${PROJECT_DIR}/tsconfig.json"
VITEST_CONFIG="${PROJECT_DIR}/vitest.config.ts"
PROJECT_SCAFFOLD_TEST_TS="${PROJECT_DIR}/tests/projectScaffoldMaintenance.test.ts"
SRC_MAIN_TS="${PROJECT_DIR}/src/main.ts"
MEDIA_PATHS_TS="${PROJECT_DIR}/src/media/generatedImagePaths.ts"
SPEC_CONTRACT_TS="${PROJECT_DIR}/src/spec/contract.ts"
SPEC_DERIVE_TS="${PROJECT_DIR}/src/spec/deriveOutputFileName.ts"
SPEC_NORMALIZE_TS="${PROJECT_DIR}/src/spec/normalizeSystemManagedFields.ts"
SPEC_RUN_TS="${PROJECT_DIR}/src/spec/runDeckSpec.ts"
SPEC_READ_TS="${PROJECT_DIR}/src/spec/readDeckSpec.ts"
SPEC_RENDERER_CONTRACT_TS="${PROJECT_DIR}/src/spec/rendererContract.ts"
SPEC_REVIEW_RENDER_TS="${PROJECT_DIR}/src/spec/renderSpecReview.ts"
SPEC_REVIEW_CONTRACT_TS="${PROJECT_DIR}/src/spec/reviewContract.ts"
SPEC_VALIDATE_TS="${PROJECT_DIR}/src/spec/validateDeckSpec.ts"
SPEC_REVIEW_VALIDATE_TS="${PROJECT_DIR}/src/spec/validateSpecReview.ts"
SPEC_WRITE_TS="${PROJECT_DIR}/src/spec/writeFileAtomic.ts"
BUILD_DECK_TS="${PROJECT_DIR}/src/buildDeck.ts"
PRESENTATION_MODEL_TS="${PROJECT_DIR}/src/presentationModel.ts"
TESTS_DIR="${PROJECT_DIR}/tests"
RUN_PROJECT_SCRIPT="${PROJECT_DIR}/run-project.sh"
VALIDATE_SCRIPT="${PROJECT_DIR}/validate-local.sh"
LEGACY_RENDERED_DIR="${PROJECT_DIR}/rendered"
LEGACY_OUTPUT_RENDERED_DIR="${PROJECT_DIR}/output/rendered"
LEGACY_VITE_CACHE_DIR="${PROJECT_DIR}/node_modules/.vite"
LEGACY_VITE_TEMP_DIR="${PROJECT_DIR}/node_modules/.vite-temp"
PROJECT_NODE_MODULES_DIR="${PROJECT_DIR}/node_modules"
ROOT_STATE_FILE="${DECK_ROOT}/.ai-native-slides/state.json"
ROOT_PACKAGE_JSON="${DECK_ROOT}/package.json"
ROOT_BIOME="${DECK_ROOT}/biome.jsonc"
ROOT_TSCONFIG_BASE="${DECK_ROOT}/tsconfig.base.json"
ROOT_HELPERS="${DECK_ROOT}/assets/pptxgenjs_helpers/index.js"
ROOT_NODE_MODULES="${DECK_ROOT}/node_modules"
ROOT_VENV_PYTHON="${DECK_ROOT}/.venv/bin/python"
CHECKED_AT="$(date '+%Y-%m-%dT%H:%M:%S%z')"
TEMPLATE_ROOT="${SKILL_ROOT}/assets/templates"
PROJECT_GITIGNORE_TEMPLATE="${TEMPLATE_ROOT}/.gitignore"
DECK_SPEC_SCHEMA_TEMPLATE="${TEMPLATE_ROOT}/spec/deck-spec.schema.json"
PACKAGE_TEMPLATE="${TEMPLATE_ROOT}/package.json"
PROJECT_TSCONFIG_TEMPLATE="${TEMPLATE_ROOT}/tsconfig.json"
PROJECT_VITEST_CONFIG_TEMPLATE="${TEMPLATE_ROOT}/vitest.config.ts"
PROJECT_SCAFFOLD_TEST_TEMPLATE="${TEMPLATE_ROOT}/tests/projectScaffoldMaintenance.test.ts"
RUN_PROJECT_TEMPLATE="${TEMPLATE_ROOT}/run-project.sh"
VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/validate-local.sh"
MAIN_TEMPLATE="${TEMPLATE_ROOT}/src/main.ts"
MEDIA_PATHS_TEMPLATE="${TEMPLATE_ROOT}/src/media/generatedImagePaths.ts"
SPEC_CONTRACT_TEMPLATE="${TEMPLATE_ROOT}/src/spec/contract.ts"
SPEC_DERIVE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/deriveOutputFileName.ts"
SPEC_NORMALIZE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/normalizeSystemManagedFields.ts"
SPEC_RUN_TEMPLATE="${TEMPLATE_ROOT}/src/spec/runDeckSpec.ts"
SPEC_READ_TEMPLATE="${TEMPLATE_ROOT}/src/spec/readDeckSpec.ts"
SPEC_RENDERER_CONTRACT_TEMPLATE="${TEMPLATE_ROOT}/src/spec/rendererContract.ts"
SPEC_REVIEW_RENDER_TEMPLATE="${TEMPLATE_ROOT}/src/spec/renderSpecReview.ts"
SPEC_REVIEW_CONTRACT_TEMPLATE="${TEMPLATE_ROOT}/src/spec/reviewContract.ts"
SPEC_VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/validateDeckSpec.ts"
SPEC_REVIEW_VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/validateSpecReview.ts"
SPEC_WRITE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/writeFileAtomic.ts"

mkdir -p "$STATE_DIR"

PROJECT_NAME_HINT="$(existing_json_string_field "$PROJECT_METADATA_FILE" "project_name" || true)"
if [[ -z "$PROJECT_NAME_HINT" ]]; then
  PROJECT_NAME_HINT="$(basename "$PROJECT_DIR")"
fi

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

add_missing() {
  MISSING_ITEMS+=("$1")
}

add_warning() {
  WARNINGS+=("$1")
}

add_suggestion() {
  SUGGESTIONS+=("$1")
}

content_test_files_present() {
  [[ -d "$TESTS_DIR" ]] && \
    find "$TESTS_DIR" -type f \( -name '*.test.ts' -o -name '*.spec.ts' \) ! -path "$PROJECT_SCAFFOLD_TEST_TS" | grep -q .
}

package_script_present() {
  local script_name="$1"
  [[ -f "$PACKAGE_JSON" ]] && grep -Eq "\"${script_name}\"[[:space:]]*:" "$PACKAGE_JSON"
}

template_file_matches() {
  local template_path="$1"
  local dest_path="$2"
  [[ -f "$template_path" ]] && [[ -f "$dest_path" ]] && cmp -s "$template_path" "$dest_path"
}

declare -a MISSING_ITEMS=()
declare -a WARNINGS=()
declare -a SUGGESTIONS=()

SKILL_REVISION="$(resolve_skill_revision "$SKILL_ROOT")"
SKILL_WORKTREE_DIRTY=false
if skill_worktree_dirty "$SKILL_ROOT"; then
  SKILL_WORKTREE_DIRTY=true
fi

ROOT_DETECTED=false
if [[ -n "$DECK_ROOT" ]]; then
  ROOT_DETECTED=true
else
  add_missing "could not locate the shared deck root above this project"
  add_suggestion "Projects must live under <deck-root>/projects/<slug>."
fi

ROOT_READY=false
if [[ "$ROOT_DETECTED" == true ]]; then
  set +e
  bash "${SCRIPT_DIR}/ensure_deck_root.sh" "$DECK_ROOT" --quiet >/dev/null 2>&1
  root_ready_exit=$?
  set -e
  if [[ "$root_ready_exit" -eq 0 ]]; then
    ROOT_READY=true
  else
    add_missing "shared deck root is not ready"
    add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to initialize shared dependencies."
  fi
fi

PROJECT_GITIGNORE_PRESENT=false
if [[ -f "$PROJECT_GITIGNORE" ]]; then PROJECT_GITIGNORE_PRESENT=true; else
  add_missing "project .gitignore is missing"
fi

PROJECT_METADATA_PRESENT=false
if [[ -f "$PROJECT_METADATA_FILE" ]]; then PROJECT_METADATA_PRESENT=true; else
  add_missing "project metadata is missing"
fi

PROJECT_METADATA_SYNCED=false
if [[ "$PROJECT_METADATA_PRESENT" == true ]]; then
  PROJECT_METADATA_CREATED_AT="$(existing_json_string_field "$PROJECT_METADATA_FILE" "created_at" || true)"
  PROJECT_METADATA_NAME="$(existing_json_string_field "$PROJECT_METADATA_FILE" "project_name" || true)"
  if [[ -z "$PROJECT_METADATA_NAME" ]]; then
    PROJECT_METADATA_NAME="$PROJECT_NAME_HINT"
  fi

  EXPECTED_PROJECT_METADATA="$(create_workspace_temp_file "$STATE_DIR" "expected-project-metadata")"
  render_project_metadata_file \
    "$DECK_ROOT" \
    "$PROJECT_DIR" \
    "$PROJECT_METADATA_NAME" \
    "$(basename "$PROJECT_DIR")" \
    "$EXPECTED_PROJECT_METADATA" \
    "$PROJECT_METADATA_CREATED_AT"

  if cmp -s "$EXPECTED_PROJECT_METADATA" "$PROJECT_METADATA_FILE"; then
    PROJECT_METADATA_SYNCED=true
  else
    add_warning "project metadata differs from the canonical machine-readable boundary definition"
  fi

  rm -f "$EXPECTED_PROJECT_METADATA"
fi

DECK_SPEC_SCHEMA_PRESENT=false
if [[ -f "$DECK_SPEC_SCHEMA" ]]; then DECK_SPEC_SCHEMA_PRESENT=true; else
  add_missing "spec/deck-spec.schema.json is missing"
fi

PACKAGE_JSON_PRESENT=false
if [[ -f "$PACKAGE_JSON" ]]; then PACKAGE_JSON_PRESENT=true; else
  add_missing "project package.json is missing"
fi

BUILD_SCRIPT_PRESENT=false
if package_script_present "build"; then BUILD_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a build script"
fi

LINT_SCRIPT_PRESENT=false
if package_script_present "lint"; then LINT_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a lint script"
fi

TYPECHECK_SCRIPT_PRESENT=false
if package_script_present "typecheck"; then TYPECHECK_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a typecheck script"
fi

TEST_SCRIPT_PRESENT=false
if package_script_present "test"; then TEST_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a test script"
fi

VALIDATE_SCRIPT_PRESENT=false
if package_script_present "validate"; then VALIDATE_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a validate script"
fi

SPEC_VALIDATE_SCRIPT_PRESENT=false
if package_script_present "spec:validate"; then SPEC_VALIDATE_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a spec:validate script"
fi
SPEC_SCRIPT_PRESENT=false
if package_script_present "spec"; then SPEC_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a spec script"
fi

VITEST_CONFIG_PRESENT=false
if [[ -f "$VITEST_CONFIG" ]]; then VITEST_CONFIG_PRESENT=true; else
  add_missing "project vitest.config.ts is missing"
fi

PROJECT_SCAFFOLD_TEST_PRESENT=false
if [[ -f "$PROJECT_SCAFFOLD_TEST_TS" ]]; then PROJECT_SCAFFOLD_TEST_PRESENT=true; else
  add_missing "tests/projectScaffoldMaintenance.test.ts is missing"
fi

RUNNER_PRESENT=false
if [[ -x "$RUN_PROJECT_SCRIPT" ]]; then RUNNER_PRESENT=true; else
  add_missing "run-project.sh is missing or not executable"
fi

VALIDATE_WRAPPER_PRESENT=false
if [[ -x "$VALIDATE_SCRIPT" ]]; then VALIDATE_WRAPPER_PRESENT=true; else
  add_missing "validate-local.sh is missing or not executable"
fi

DECK_ENTRY_PRESENT=false
if [[ -f "$SRC_MAIN_TS" ]]; then DECK_ENTRY_PRESENT=true; else
  add_missing "src/main.ts is missing"
fi

MEDIA_PATHS_PRESENT=false
if [[ -f "$MEDIA_PATHS_TS" ]]; then MEDIA_PATHS_PRESENT=true; else
  add_missing "src/media/generatedImagePaths.ts is missing"
fi

SPEC_CONTRACT_PRESENT=false
if [[ -f "$SPEC_CONTRACT_TS" ]]; then SPEC_CONTRACT_PRESENT=true; else
  add_missing "src/spec/contract.ts is missing"
fi

SPEC_DERIVE_PRESENT=false
if [[ -f "$SPEC_DERIVE_TS" ]]; then SPEC_DERIVE_PRESENT=true; else
  add_missing "src/spec/deriveOutputFileName.ts is missing"
fi

SPEC_NORMALIZE_PRESENT=false
if [[ -f "$SPEC_NORMALIZE_TS" ]]; then SPEC_NORMALIZE_PRESENT=true; else
  add_missing "src/spec/normalizeSystemManagedFields.ts is missing"
fi

SPEC_RUN_PRESENT=false
if [[ -f "$SPEC_RUN_TS" ]]; then SPEC_RUN_PRESENT=true; else
  add_missing "src/spec/runDeckSpec.ts is missing"
fi

SPEC_READ_PRESENT=false
if [[ -f "$SPEC_READ_TS" ]]; then SPEC_READ_PRESENT=true; else
  add_missing "src/spec/readDeckSpec.ts is missing"
fi

SPEC_RENDERER_CONTRACT_PRESENT=false
if [[ -f "$SPEC_RENDERER_CONTRACT_TS" ]]; then SPEC_RENDERER_CONTRACT_PRESENT=true; else
  add_missing "src/spec/rendererContract.ts is missing"
fi

SPEC_REVIEW_RENDER_PRESENT=false
if [[ -f "$SPEC_REVIEW_RENDER_TS" ]]; then SPEC_REVIEW_RENDER_PRESENT=true; else
  add_missing "src/spec/renderSpecReview.ts is missing"
fi

SPEC_REVIEW_CONTRACT_PRESENT=false
if [[ -f "$SPEC_REVIEW_CONTRACT_TS" ]]; then SPEC_REVIEW_CONTRACT_PRESENT=true; else
  add_missing "src/spec/reviewContract.ts is missing"
fi

SPEC_VALIDATE_PRESENT=false
if [[ -f "$SPEC_VALIDATE_TS" ]]; then SPEC_VALIDATE_PRESENT=true; else
  add_missing "src/spec/validateDeckSpec.ts is missing"
fi

SPEC_REVIEW_VALIDATE_PRESENT=false
if [[ -f "$SPEC_REVIEW_VALIDATE_TS" ]]; then SPEC_REVIEW_VALIDATE_PRESENT=true; else
  add_missing "src/spec/validateSpecReview.ts is missing"
fi

SPEC_WRITE_PRESENT=false
if [[ -f "$SPEC_WRITE_TS" ]]; then SPEC_WRITE_PRESENT=true; else
  add_missing "src/spec/writeFileAtomic.ts is missing"
fi

TSCONFIG_PRESENT=false
if [[ -f "$TSCONFIG_JSON" ]]; then TSCONFIG_PRESENT=true; else
  add_missing "project tsconfig.json is missing"
fi

PROJECT_GITIGNORE_SYNCED=false
if template_file_matches "$PROJECT_GITIGNORE_TEMPLATE" "$PROJECT_GITIGNORE"; then
  PROJECT_GITIGNORE_SYNCED=true
elif [[ "$PROJECT_GITIGNORE_PRESENT" == true ]]; then
  add_warning "project .gitignore differs from the template-managed version"
fi

DECK_SPEC_SCHEMA_SYNCED=false
if template_file_matches "$DECK_SPEC_SCHEMA_TEMPLATE" "$DECK_SPEC_SCHEMA"; then
  DECK_SPEC_SCHEMA_SYNCED=true
elif [[ "$DECK_SPEC_SCHEMA_PRESENT" == true ]]; then
  add_warning "spec/deck-spec.schema.json differs from the template-managed version"
fi

PACKAGE_JSON_SYNCED=false
if template_file_matches "$PACKAGE_TEMPLATE" "$PACKAGE_JSON"; then
  PACKAGE_JSON_SYNCED=true
elif [[ "$PACKAGE_JSON_PRESENT" == true ]]; then
  add_warning "project package.json differs from the template-managed version"
fi

TSCONFIG_SYNCED=false
if template_file_matches "$PROJECT_TSCONFIG_TEMPLATE" "$TSCONFIG_JSON"; then
  TSCONFIG_SYNCED=true
elif [[ "$TSCONFIG_PRESENT" == true ]]; then
  add_warning "project tsconfig.json differs from the template-managed version"
fi

VITEST_CONFIG_SYNCED=false
if template_file_matches "$PROJECT_VITEST_CONFIG_TEMPLATE" "$VITEST_CONFIG"; then
  VITEST_CONFIG_SYNCED=true
elif [[ "$VITEST_CONFIG_PRESENT" == true ]]; then
  add_warning "project vitest.config.ts differs from the template-managed version"
fi

PROJECT_SCAFFOLD_TEST_SYNCED=false
if template_file_matches "$PROJECT_SCAFFOLD_TEST_TEMPLATE" "$PROJECT_SCAFFOLD_TEST_TS"; then
  PROJECT_SCAFFOLD_TEST_SYNCED=true
elif [[ "$PROJECT_SCAFFOLD_TEST_PRESENT" == true ]]; then
  add_warning "tests/projectScaffoldMaintenance.test.ts differs from the template-managed version"
fi

RUNNER_SYNCED=false
if template_file_matches "$RUN_PROJECT_TEMPLATE" "$RUN_PROJECT_SCRIPT"; then
  RUNNER_SYNCED=true
elif [[ -f "$RUN_PROJECT_SCRIPT" ]]; then
  add_warning "run-project.sh differs from the template-managed version"
fi

VALIDATE_WRAPPER_SYNCED=false
if template_file_matches "$VALIDATE_TEMPLATE" "$VALIDATE_SCRIPT"; then
  VALIDATE_WRAPPER_SYNCED=true
elif [[ -f "$VALIDATE_SCRIPT" ]]; then
  add_warning "validate-local.sh differs from the template-managed version"
fi

DECK_ENTRY_SYNCED=false
if template_file_matches "$MAIN_TEMPLATE" "$SRC_MAIN_TS"; then
  DECK_ENTRY_SYNCED=true
elif [[ "$DECK_ENTRY_PRESENT" == true ]]; then
  add_warning "src/main.ts differs from the template-managed version"
fi

MEDIA_PATHS_SYNCED=false
if template_file_matches "$MEDIA_PATHS_TEMPLATE" "$MEDIA_PATHS_TS"; then
  MEDIA_PATHS_SYNCED=true
elif [[ "$MEDIA_PATHS_PRESENT" == true ]]; then
  add_warning "src/media/generatedImagePaths.ts differs from the template-managed version"
fi

SPEC_CONTRACT_SYNCED=false
if template_file_matches "$SPEC_CONTRACT_TEMPLATE" "$SPEC_CONTRACT_TS"; then
  SPEC_CONTRACT_SYNCED=true
elif [[ "$SPEC_CONTRACT_PRESENT" == true ]]; then
  add_warning "src/spec/contract.ts differs from the template-managed version"
fi

SPEC_DERIVE_SYNCED=false
if template_file_matches "$SPEC_DERIVE_TEMPLATE" "$SPEC_DERIVE_TS"; then
  SPEC_DERIVE_SYNCED=true
elif [[ "$SPEC_DERIVE_PRESENT" == true ]]; then
  add_warning "src/spec/deriveOutputFileName.ts differs from the template-managed version"
fi

SPEC_NORMALIZE_SYNCED=false
if template_file_matches "$SPEC_NORMALIZE_TEMPLATE" "$SPEC_NORMALIZE_TS"; then
  SPEC_NORMALIZE_SYNCED=true
elif [[ "$SPEC_NORMALIZE_PRESENT" == true ]]; then
  add_warning "src/spec/normalizeSystemManagedFields.ts differs from the template-managed version"
fi

SPEC_RUN_SYNCED=false
if template_file_matches "$SPEC_RUN_TEMPLATE" "$SPEC_RUN_TS"; then
  SPEC_RUN_SYNCED=true
elif [[ "$SPEC_RUN_PRESENT" == true ]]; then
  add_warning "src/spec/runDeckSpec.ts differs from the template-managed version"
fi

SPEC_READ_SYNCED=false
if template_file_matches "$SPEC_READ_TEMPLATE" "$SPEC_READ_TS"; then
  SPEC_READ_SYNCED=true
elif [[ "$SPEC_READ_PRESENT" == true ]]; then
  add_warning "src/spec/readDeckSpec.ts differs from the template-managed version"
fi

SPEC_RENDERER_CONTRACT_SYNCED=false
if template_file_matches "$SPEC_RENDERER_CONTRACT_TEMPLATE" "$SPEC_RENDERER_CONTRACT_TS"; then
  SPEC_RENDERER_CONTRACT_SYNCED=true
elif [[ "$SPEC_RENDERER_CONTRACT_PRESENT" == true ]]; then
  add_warning "src/spec/rendererContract.ts differs from the template-managed version"
fi

SPEC_REVIEW_RENDER_SYNCED=false
if template_file_matches "$SPEC_REVIEW_RENDER_TEMPLATE" "$SPEC_REVIEW_RENDER_TS"; then
  SPEC_REVIEW_RENDER_SYNCED=true
elif [[ "$SPEC_REVIEW_RENDER_PRESENT" == true ]]; then
  add_warning "src/spec/renderSpecReview.ts differs from the template-managed version"
fi

SPEC_REVIEW_CONTRACT_SYNCED=false
if template_file_matches "$SPEC_REVIEW_CONTRACT_TEMPLATE" "$SPEC_REVIEW_CONTRACT_TS"; then
  SPEC_REVIEW_CONTRACT_SYNCED=true
elif [[ "$SPEC_REVIEW_CONTRACT_PRESENT" == true ]]; then
  add_warning "src/spec/reviewContract.ts differs from the template-managed version"
fi

SPEC_VALIDATE_SYNCED=false
if template_file_matches "$SPEC_VALIDATE_TEMPLATE" "$SPEC_VALIDATE_TS"; then
  SPEC_VALIDATE_SYNCED=true
elif [[ "$SPEC_VALIDATE_PRESENT" == true ]]; then
  add_warning "src/spec/validateDeckSpec.ts differs from the template-managed version"
fi

SPEC_REVIEW_VALIDATE_SYNCED=false
if template_file_matches "$SPEC_REVIEW_VALIDATE_TEMPLATE" "$SPEC_REVIEW_VALIDATE_TS"; then
  SPEC_REVIEW_VALIDATE_SYNCED=true
elif [[ "$SPEC_REVIEW_VALIDATE_PRESENT" == true ]]; then
  add_warning "src/spec/validateSpecReview.ts differs from the template-managed version"
fi

SPEC_WRITE_SYNCED=false
if template_file_matches "$SPEC_WRITE_TEMPLATE" "$SPEC_WRITE_TS"; then
  SPEC_WRITE_SYNCED=true
elif [[ "$SPEC_WRITE_PRESENT" == true ]]; then
  add_warning "src/spec/writeFileAtomic.ts differs from the template-managed version"
fi

BUILD_DECK_PRESENT=false
if [[ -f "$BUILD_DECK_TS" ]]; then
  BUILD_DECK_PRESENT=true
fi

PRESENTATION_MODEL_PRESENT=false
if [[ -f "$PRESENTATION_MODEL_TS" ]]; then
  PRESENTATION_MODEL_PRESENT=true
fi

CONTENT_TESTS_PRESENT=false
if content_test_files_present; then
  CONTENT_TESTS_PRESENT=true
fi

ROOT_PACKAGE_PRESENT=false
ROOT_BIOME_PRESENT=false
ROOT_TSCONFIG_BASE_PRESENT=false
ROOT_HELPERS_PRESENT=false
ROOT_NODE_DEPS_PRESENT=false
ROOT_VENV_PRESENT=false
LEGACY_RENDERED_DIR_PRESENT=false
LEGACY_OUTPUT_RENDERED_DIR_PRESENT=false
LEGACY_VITE_CACHE_PRESENT=false
LEGACY_VITE_TEMP_PRESENT=false
EMPTY_PROJECT_NODE_MODULES_PRESENT=false

if [[ "$ROOT_DETECTED" == true ]]; then
  [[ -f "$ROOT_PACKAGE_JSON" ]] && ROOT_PACKAGE_PRESENT=true
  [[ -f "$ROOT_BIOME" ]] && ROOT_BIOME_PRESENT=true
  [[ -f "$ROOT_TSCONFIG_BASE" ]] && ROOT_TSCONFIG_BASE_PRESENT=true
  [[ -f "$ROOT_HELPERS" ]] && ROOT_HELPERS_PRESENT=true
  [[ -d "$ROOT_NODE_MODULES/pptxgenjs" ]] && ROOT_NODE_DEPS_PRESENT=true
  [[ -x "$ROOT_VENV_PYTHON" ]] && ROOT_VENV_PRESENT=true
fi

if [[ -d "$LEGACY_RENDERED_DIR" ]]; then
  LEGACY_RENDERED_DIR_PRESENT=true
  add_warning "legacy rendered/ directory is present at the project root"
fi

if [[ -d "$LEGACY_OUTPUT_RENDERED_DIR" ]]; then
  LEGACY_OUTPUT_RENDERED_DIR_PRESENT=true
  add_warning "legacy output/rendered directory is present"
fi

if [[ -d "$LEGACY_VITE_CACHE_DIR" ]]; then
  LEGACY_VITE_CACHE_PRESENT=true
  add_warning "project-local node_modules/.vite cache is present"
fi

if [[ -d "$LEGACY_VITE_TEMP_DIR" ]]; then
  LEGACY_VITE_TEMP_PRESENT=true
  add_warning "project-local node_modules/.vite-temp cache is present"
fi

if [[ -d "$PROJECT_NODE_MODULES_DIR" ]] && [[ -z "$(find "$PROJECT_NODE_MODULES_DIR" -mindepth 1 -print -quit)" ]]; then
  EMPTY_PROJECT_NODE_MODULES_PRESENT=true
  add_warning "empty project-local node_modules directory is present"
fi

if [[ "$LEGACY_RENDERED_DIR_PRESENT" == true ]] || \
   [[ "$LEGACY_OUTPUT_RENDERED_DIR_PRESENT" == true ]] || \
   [[ "$LEGACY_VITE_CACHE_PRESENT" == true ]] || \
   [[ "$LEGACY_VITE_TEMP_PRESENT" == true ]] || \
   [[ "$EMPTY_PROJECT_NODE_MODULES_PRESENT" == true ]]; then
  add_suggestion "Legacy generated directories from an older layout are present. If you are maintaining or migrating this project, see \`$SKILL_ROOT/scripts/maintenance/maintenance-workflow.md\`."
fi

PROJECT_READY=false
if [[ "$ROOT_DETECTED" == true ]] && \
   [[ "$ROOT_READY" == true ]] && \
   [[ "$PROJECT_GITIGNORE_PRESENT" == true ]] && \
   [[ "$PROJECT_GITIGNORE_SYNCED" == true ]] && \
   [[ "$PROJECT_METADATA_PRESENT" == true ]] && \
   [[ "$PROJECT_METADATA_SYNCED" == true ]] && \
   [[ "$DECK_SPEC_SCHEMA_PRESENT" == true ]] && \
   [[ "$DECK_SPEC_SCHEMA_SYNCED" == true ]] && \
   [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$PACKAGE_JSON_SYNCED" == true ]] && \
   [[ "$BUILD_SCRIPT_PRESENT" == true ]] && \
   [[ "$LINT_SCRIPT_PRESENT" == true ]] && \
   [[ "$SPEC_SCRIPT_PRESENT" == true ]] && \
   [[ "$SPEC_VALIDATE_SCRIPT_PRESENT" == true ]] && \
   [[ "$TYPECHECK_SCRIPT_PRESENT" == true ]] && \
   [[ "$TEST_SCRIPT_PRESENT" == true ]] && \
   [[ "$VALIDATE_SCRIPT_PRESENT" == true ]] && \
   [[ "$VITEST_CONFIG_PRESENT" == true ]] && \
   [[ "$VITEST_CONFIG_SYNCED" == true ]] && \
   [[ "$PROJECT_SCAFFOLD_TEST_PRESENT" == true ]] && \
   [[ "$PROJECT_SCAFFOLD_TEST_SYNCED" == true ]] && \
   [[ "$RUNNER_PRESENT" == true ]] && \
   [[ "$RUNNER_SYNCED" == true ]] && \
   [[ "$VALIDATE_WRAPPER_PRESENT" == true ]] && \
   [[ "$VALIDATE_WRAPPER_SYNCED" == true ]] && \
   [[ "$DECK_ENTRY_PRESENT" == true ]] && \
   [[ "$DECK_ENTRY_SYNCED" == true ]] && \
   [[ "$MEDIA_PATHS_PRESENT" == true ]] && \
   [[ "$MEDIA_PATHS_SYNCED" == true ]] && \
   [[ "$SPEC_CONTRACT_PRESENT" == true ]] && \
   [[ "$SPEC_CONTRACT_SYNCED" == true ]] && \
   [[ "$SPEC_DERIVE_PRESENT" == true ]] && \
   [[ "$SPEC_DERIVE_SYNCED" == true ]] && \
   [[ "$SPEC_NORMALIZE_PRESENT" == true ]] && \
   [[ "$SPEC_NORMALIZE_SYNCED" == true ]] && \
   [[ "$SPEC_RUN_PRESENT" == true ]] && \
   [[ "$SPEC_RUN_SYNCED" == true ]] && \
   [[ "$SPEC_READ_PRESENT" == true ]] && \
   [[ "$SPEC_READ_SYNCED" == true ]] && \
   [[ "$SPEC_RENDERER_CONTRACT_PRESENT" == true ]] && \
   [[ "$SPEC_RENDERER_CONTRACT_SYNCED" == true ]] && \
   [[ "$SPEC_REVIEW_RENDER_PRESENT" == true ]] && \
   [[ "$SPEC_REVIEW_RENDER_SYNCED" == true ]] && \
   [[ "$SPEC_REVIEW_CONTRACT_PRESENT" == true ]] && \
   [[ "$SPEC_REVIEW_CONTRACT_SYNCED" == true ]] && \
   [[ "$SPEC_VALIDATE_PRESENT" == true ]] && \
   [[ "$SPEC_VALIDATE_SYNCED" == true ]] && \
   [[ "$SPEC_REVIEW_VALIDATE_PRESENT" == true ]] && \
   [[ "$SPEC_REVIEW_VALIDATE_SYNCED" == true ]] && \
   [[ "$SPEC_WRITE_PRESENT" == true ]] && \
   [[ "$SPEC_WRITE_SYNCED" == true ]] && \
   [[ "$TSCONFIG_PRESENT" == true ]] && \
   [[ "$TSCONFIG_SYNCED" == true ]]; then
  PROJECT_READY=true
fi

BOOTSTRAP_COMPLETE=false
if [[ "$PROJECT_GITIGNORE_PRESENT" == true ]] && \
   [[ "$PROJECT_GITIGNORE_SYNCED" == true ]] && \
   [[ "$PROJECT_METADATA_PRESENT" == true ]] && \
   [[ "$PROJECT_METADATA_SYNCED" == true ]] && \
   [[ "$DECK_SPEC_SCHEMA_PRESENT" == true ]] && \
   [[ "$DECK_SPEC_SCHEMA_SYNCED" == true ]] && \
   [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$PACKAGE_JSON_SYNCED" == true ]] && \
   [[ "$VITEST_CONFIG_PRESENT" == true ]] && \
   [[ "$VITEST_CONFIG_SYNCED" == true ]] && \
   [[ "$PROJECT_SCAFFOLD_TEST_PRESENT" == true ]] && \
   [[ "$PROJECT_SCAFFOLD_TEST_SYNCED" == true ]] && \
   [[ "$RUNNER_PRESENT" == true ]] && \
   [[ "$RUNNER_SYNCED" == true ]] && \
   [[ "$VALIDATE_WRAPPER_PRESENT" == true ]] && \
   [[ "$VALIDATE_WRAPPER_SYNCED" == true ]] && \
   [[ "$DECK_ENTRY_PRESENT" == true ]] && \
   [[ "$DECK_ENTRY_SYNCED" == true ]] && \
   [[ "$MEDIA_PATHS_PRESENT" == true ]] && \
   [[ "$MEDIA_PATHS_SYNCED" == true ]] && \
   [[ "$SPEC_CONTRACT_PRESENT" == true ]] && \
   [[ "$SPEC_CONTRACT_SYNCED" == true ]] && \
   [[ "$SPEC_DERIVE_PRESENT" == true ]] && \
   [[ "$SPEC_DERIVE_SYNCED" == true ]] && \
   [[ "$SPEC_NORMALIZE_PRESENT" == true ]] && \
   [[ "$SPEC_NORMALIZE_SYNCED" == true ]] && \
   [[ "$SPEC_RUN_PRESENT" == true ]] && \
   [[ "$SPEC_RUN_SYNCED" == true ]] && \
   [[ "$SPEC_READ_PRESENT" == true ]] && \
   [[ "$SPEC_READ_SYNCED" == true ]] && \
   [[ "$SPEC_RENDERER_CONTRACT_PRESENT" == true ]] && \
   [[ "$SPEC_RENDERER_CONTRACT_SYNCED" == true ]] && \
   [[ "$SPEC_REVIEW_RENDER_PRESENT" == true ]] && \
   [[ "$SPEC_REVIEW_RENDER_SYNCED" == true ]] && \
   [[ "$SPEC_REVIEW_CONTRACT_PRESENT" == true ]] && \
   [[ "$SPEC_REVIEW_CONTRACT_SYNCED" == true ]] && \
   [[ "$SPEC_VALIDATE_PRESENT" == true ]] && \
   [[ "$SPEC_VALIDATE_SYNCED" == true ]] && \
   [[ "$SPEC_REVIEW_VALIDATE_PRESENT" == true ]] && \
   [[ "$SPEC_REVIEW_VALIDATE_SYNCED" == true ]] && \
   [[ "$SPEC_WRITE_PRESENT" == true ]] && \
   [[ "$SPEC_WRITE_SYNCED" == true ]] && \
   [[ "$TSCONFIG_PRESENT" == true ]] && \
   [[ "$TSCONFIG_SYNCED" == true ]]; then
  BOOTSTRAP_COMPLETE=true
fi

if [[ "$ROOT_DETECTED" == true ]] && [[ "$BOOTSTRAP_COMPLETE" != true ]]; then
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_project.sh\" \"$DECK_ROOT\" \"$PROJECT_NAME_HINT\"\` to refresh template-managed project files."
fi

CONTENT_READY=false
if [[ "$BUILD_DECK_PRESENT" == true ]] && \
   [[ "$PRESENTATION_MODEL_PRESENT" == true ]] && \
   [[ "$CONTENT_TESTS_PRESENT" == true ]]; then
  CONTENT_READY=true
else
  add_warning "project content files have not been generated yet"
  add_suggestion "Generate \`src/buildDeck.ts\`, \`src/presentationModel.ts\`, and at least one \`tests/*.test.ts\` file from the user's prompt before running the full build/test/validate loop."
fi

{
  echo "{"
  echo "  \"skill_name\": \"ai-native-slides\","
  echo "  \"skill_dir\": \"$(json_escape "$SKILL_ROOT")\","
  echo "  \"skill_revision\": \"$(json_escape "$SKILL_REVISION")\","
  echo "  \"skill_worktree_dirty\": ${SKILL_WORKTREE_DIRTY},"
  echo "  \"checked_at\": \"$(json_escape "$CHECKED_AT")\","
  echo "  \"deck_root\": \"$(json_escape "$DECK_ROOT")\","
  echo "  \"project_dir\": \"$(json_escape "$PROJECT_DIR")\","
  echo "  \"root_state_file\": \"$(json_escape "$ROOT_STATE_FILE")\","
  echo "  \"state_file\": \"$(json_escape "$STATE_FILE")\","
  echo "  \"bootstrap_complete\": ${BOOTSTRAP_COMPLETE},"
  echo "  \"project_ready\": ${PROJECT_READY},"
  echo "  \"content_ready\": ${CONTENT_READY},"
  echo "  \"status\": {"
  echo "    \"root_detected\": ${ROOT_DETECTED},"
  echo "    \"root_ready\": ${ROOT_READY},"
  echo "    \"project_gitignore_present\": ${PROJECT_GITIGNORE_PRESENT},"
  echo "    \"project_gitignore_synced\": ${PROJECT_GITIGNORE_SYNCED},"
  echo "    \"project_metadata_present\": ${PROJECT_METADATA_PRESENT},"
  echo "    \"project_metadata_synced\": ${PROJECT_METADATA_SYNCED},"
  echo "    \"deck_spec_schema_present\": ${DECK_SPEC_SCHEMA_PRESENT},"
  echo "    \"deck_spec_schema_synced\": ${DECK_SPEC_SCHEMA_SYNCED},"
  echo "    \"package_json_present\": ${PACKAGE_JSON_PRESENT},"
  echo "    \"package_json_synced\": ${PACKAGE_JSON_SYNCED},"
  echo "    \"build_script_present\": ${BUILD_SCRIPT_PRESENT},"
  echo "    \"lint_script_present\": ${LINT_SCRIPT_PRESENT},"
  echo "    \"spec_script_present\": ${SPEC_SCRIPT_PRESENT},"
  echo "    \"spec_validate_script_present\": ${SPEC_VALIDATE_SCRIPT_PRESENT},"
  echo "    \"typecheck_script_present\": ${TYPECHECK_SCRIPT_PRESENT},"
  echo "    \"test_script_present\": ${TEST_SCRIPT_PRESENT},"
    echo "    \"validate_script_present\": ${VALIDATE_SCRIPT_PRESENT},"
    echo "    \"vitest_config_present\": ${VITEST_CONFIG_PRESENT},"
    echo "    \"vitest_config_synced\": ${VITEST_CONFIG_SYNCED},"
    echo "    \"project_scaffold_test_present\": ${PROJECT_SCAFFOLD_TEST_PRESENT},"
    echo "    \"project_scaffold_test_synced\": ${PROJECT_SCAFFOLD_TEST_SYNCED},"
    echo "    \"runner_present\": ${RUNNER_PRESENT},"
  echo "    \"runner_synced\": ${RUNNER_SYNCED},"
  echo "    \"validate_wrapper_present\": ${VALIDATE_WRAPPER_PRESENT},"
  echo "    \"validate_wrapper_synced\": ${VALIDATE_WRAPPER_SYNCED},"
  echo "    \"deck_entry_present\": ${DECK_ENTRY_PRESENT},"
  echo "    \"deck_entry_synced\": ${DECK_ENTRY_SYNCED},"
  echo "    \"generated_image_paths_present\": ${MEDIA_PATHS_PRESENT},"
  echo "    \"generated_image_paths_synced\": ${MEDIA_PATHS_SYNCED},"
  echo "    \"spec_contract_present\": ${SPEC_CONTRACT_PRESENT},"
  echo "    \"spec_contract_synced\": ${SPEC_CONTRACT_SYNCED},"
  echo "    \"spec_derive_present\": ${SPEC_DERIVE_PRESENT},"
  echo "    \"spec_derive_synced\": ${SPEC_DERIVE_SYNCED},"
  echo "    \"spec_normalize_present\": ${SPEC_NORMALIZE_PRESENT},"
  echo "    \"spec_normalize_synced\": ${SPEC_NORMALIZE_SYNCED},"
  echo "    \"spec_run_present\": ${SPEC_RUN_PRESENT},"
  echo "    \"spec_run_synced\": ${SPEC_RUN_SYNCED},"
  echo "    \"spec_read_present\": ${SPEC_READ_PRESENT},"
  echo "    \"spec_read_synced\": ${SPEC_READ_SYNCED},"
  echo "    \"spec_renderer_contract_present\": ${SPEC_RENDERER_CONTRACT_PRESENT},"
  echo "    \"spec_renderer_contract_synced\": ${SPEC_RENDERER_CONTRACT_SYNCED},"
  echo "    \"spec_review_render_present\": ${SPEC_REVIEW_RENDER_PRESENT},"
  echo "    \"spec_review_render_synced\": ${SPEC_REVIEW_RENDER_SYNCED},"
  echo "    \"spec_review_contract_present\": ${SPEC_REVIEW_CONTRACT_PRESENT},"
  echo "    \"spec_review_contract_synced\": ${SPEC_REVIEW_CONTRACT_SYNCED},"
  echo "    \"spec_validate_present\": ${SPEC_VALIDATE_PRESENT},"
  echo "    \"spec_validate_synced\": ${SPEC_VALIDATE_SYNCED},"
  echo "    \"spec_review_validate_present\": ${SPEC_REVIEW_VALIDATE_PRESENT},"
  echo "    \"spec_review_validate_synced\": ${SPEC_REVIEW_VALIDATE_SYNCED},"
  echo "    \"spec_write_present\": ${SPEC_WRITE_PRESENT},"
  echo "    \"spec_write_synced\": ${SPEC_WRITE_SYNCED},"
  echo "    \"tsconfig_present\": ${TSCONFIG_PRESENT},"
  echo "    \"tsconfig_synced\": ${TSCONFIG_SYNCED},"
  echo "    \"build_deck_present\": ${BUILD_DECK_PRESENT},"
  echo "    \"presentation_model_present\": ${PRESENTATION_MODEL_PRESENT},"
  echo "    \"content_tests_present\": ${CONTENT_TESTS_PRESENT},"
  echo "    \"root_package_present\": ${ROOT_PACKAGE_PRESENT},"
  echo "    \"root_biome_present\": ${ROOT_BIOME_PRESENT},"
  echo "    \"root_tsconfig_base_present\": ${ROOT_TSCONFIG_BASE_PRESENT},"
  echo "    \"root_helpers_present\": ${ROOT_HELPERS_PRESENT},"
  echo "    \"root_node_dependencies_installed\": ${ROOT_NODE_DEPS_PRESENT},"
    echo "    \"root_venv_python_present\": ${ROOT_VENV_PRESENT},"
    echo "    \"legacy_rendered_dir_present\": ${LEGACY_RENDERED_DIR_PRESENT},"
    echo "    \"legacy_output_rendered_dir_present\": ${LEGACY_OUTPUT_RENDERED_DIR_PRESENT},"
    echo "    \"legacy_vite_cache_present\": ${LEGACY_VITE_CACHE_PRESENT},"
    echo "    \"legacy_vite_temp_present\": ${LEGACY_VITE_TEMP_PRESENT},"
    echo "    \"empty_project_node_modules_present\": ${EMPTY_PROJECT_NODE_MODULES_PRESENT}"
  echo "  },"
  echo "  \"missing\": ["
  if [[ "${#MISSING_ITEMS[@]}" -gt 0 ]]; then
    for i in "${!MISSING_ITEMS[@]}"; do
      suffix=","
      if [[ "$i" -eq $((${#MISSING_ITEMS[@]} - 1)) ]]; then
        suffix=""
      fi
      echo "    \"$(json_escape "${MISSING_ITEMS[$i]}")\"${suffix}"
    done
  fi
  echo "  ],"
  echo "  \"warnings\": ["
  if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
    for i in "${!WARNINGS[@]}"; do
      suffix=","
      if [[ "$i" -eq $((${#WARNINGS[@]} - 1)) ]]; then
        suffix=""
      fi
      echo "    \"$(json_escape "${WARNINGS[$i]}")\"${suffix}"
    done
  fi
  echo "  ],"
  echo "  \"suggestions\": ["
  if [[ "${#SUGGESTIONS[@]}" -gt 0 ]]; then
    for i in "${!SUGGESTIONS[@]}"; do
      suffix=","
      if [[ "$i" -eq $((${#SUGGESTIONS[@]} - 1)) ]]; then
        suffix=""
      fi
      echo "    \"$(json_escape "${SUGGESTIONS[$i]}")\"${suffix}"
    done
  fi
  echo "  ]"
  echo "}"
} > "$STATE_FILE"

if [[ "$JSON_ONLY" -eq 1 ]]; then
  cat "$STATE_FILE"
  exit 0
fi

if [[ "$PROJECT_READY" == true ]]; then
  if [[ "$QUIET" -ne 1 ]]; then
    if [[ "$CONTENT_READY" == true ]]; then
      echo "Project ready: $PROJECT_DIR"
    else
      echo "Project scaffold ready: $PROJECT_DIR"
      echo "Deck content files still need to be generated from the user's prompt."
    fi
    echo "State file: $STATE_FILE"
    if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
      for item in "${WARNINGS[@]}"; do
        echo "- Warning: $item"
      done
    fi
    if [[ "${#SUGGESTIONS[@]}" -gt 0 ]]; then
      echo "Suggested next steps:"
      for item in "${SUGGESTIONS[@]}"; do
        echo "- $item"
      done
    fi
  fi
  exit 0
fi

if [[ "$QUIET" -ne 1 ]]; then
  echo "Project incomplete: $PROJECT_DIR"
  echo "State file: $STATE_FILE"
  if [[ "${#MISSING_ITEMS[@]}" -gt 0 ]]; then
    for item in "${MISSING_ITEMS[@]}"; do
      echo "- Missing: $item"
    done
  fi
  if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
    for item in "${WARNINGS[@]}"; do
      echo "- Warning: $item"
    done
  fi
  if [[ "${#SUGGESTIONS[@]}" -gt 0 ]]; then
    echo "Suggested next steps:"
    for item in "${SUGGESTIONS[@]}"; do
      echo "- $item"
    done
  fi
fi

exit 1
