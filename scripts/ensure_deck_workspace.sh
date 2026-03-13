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
  add_missing_root_hint=1
else
  add_missing_root_hint=0
fi

STATE_DIR="${PROJECT_DIR}/.ai-native-slides"
STATE_FILE="${STATE_DIR}/state.json"
PROJECT_METADATA_FILE="$(project_metadata_path "$PROJECT_DIR")"
PACKAGE_JSON="${PROJECT_DIR}/package.json"
TSCONFIG_JSON="${PROJECT_DIR}/tsconfig.json"
SRC_MAIN_TS="${PROJECT_DIR}/src/main.ts"
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

mkdir -p "$STATE_DIR"

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

package_script_present() {
  local script_name="$1"
  [[ -f "$PACKAGE_JSON" ]] && grep -Eq "\"${script_name}\"[[:space:]]*:" "$PACKAGE_JSON"
}

declare -a MISSING_ITEMS=()
declare -a WARNINGS=()
declare -a SUGGESTIONS=()

SKILL_REVISION="$(
  git -C "$SKILL_ROOT" rev-parse --short HEAD 2>/dev/null || \
  shasum -a 256 "$SKILL_ROOT/SKILL.md" | awk '{print $1}'
)"

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
    add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/repair_deck_root.sh\" \"$DECK_ROOT\"\` to repair shared dependencies."
  fi
fi

PROJECT_METADATA_PRESENT=false
if [[ -f "$PROJECT_METADATA_FILE" ]]; then PROJECT_METADATA_PRESENT=true; else
  add_missing "project metadata is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\" --force\` to refresh project bootstrap files."
fi

PACKAGE_JSON_PRESENT=false
if [[ -f "$PACKAGE_JSON" ]]; then PACKAGE_JSON_PRESENT=true; else
  add_missing "project package.json is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\"\` to scaffold the project files."
fi

BUILD_SCRIPT_PRESENT=false
if package_script_present "build"; then BUILD_SCRIPT_PRESENT=true; else
  add_missing "project package.json does not define a build script"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\" --force\` to restore the project runner scripts."
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

RUNNER_PRESENT=false
if [[ -x "$RUN_PROJECT_SCRIPT" ]]; then RUNNER_PRESENT=true; else
  add_missing "run-project.sh is missing or not executable"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\" --force\` to restore it."
fi

VALIDATE_WRAPPER_PRESENT=false
if [[ -x "$VALIDATE_SCRIPT" ]]; then VALIDATE_WRAPPER_PRESENT=true; else
  add_missing "validate-local.sh is missing or not executable"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\" --force\` to restore it."
fi

DECK_ENTRY_PRESENT=false
if [[ -f "$SRC_MAIN_TS" ]]; then DECK_ENTRY_PRESENT=true; else
  add_missing "src/main.ts is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\"\` to scaffold the project entrypoint."
fi

TSCONFIG_PRESENT=false
if [[ -f "$TSCONFIG_JSON" ]]; then TSCONFIG_PRESENT=true; else
  add_missing "project tsconfig.json is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$PROJECT_DIR\"\` to scaffold the project tsconfig."
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
if [[ -d "$TESTS_DIR" ]] && find "$TESTS_DIR" -type f \( -name '*.test.ts' -o -name '*.spec.ts' \) | grep -q .; then
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
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/clean_deck_project.sh\" \"$PROJECT_DIR\"\` to remove legacy generated directories and caches."
fi

PROJECT_READY=false
if [[ "$ROOT_DETECTED" == true ]] && \
   [[ "$ROOT_READY" == true ]] && \
   [[ "$PROJECT_METADATA_PRESENT" == true ]] && \
   [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$BUILD_SCRIPT_PRESENT" == true ]] && \
   [[ "$LINT_SCRIPT_PRESENT" == true ]] && \
   [[ "$TYPECHECK_SCRIPT_PRESENT" == true ]] && \
   [[ "$TEST_SCRIPT_PRESENT" == true ]] && \
   [[ "$VALIDATE_SCRIPT_PRESENT" == true ]] && \
   [[ "$RUNNER_PRESENT" == true ]] && \
   [[ "$VALIDATE_WRAPPER_PRESENT" == true ]] && \
   [[ "$DECK_ENTRY_PRESENT" == true ]] && \
   [[ "$TSCONFIG_PRESENT" == true ]]; then
  PROJECT_READY=true
fi

BOOTSTRAP_COMPLETE=false
if [[ "$PROJECT_METADATA_PRESENT" == true ]] && \
   [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$RUNNER_PRESENT" == true ]] && \
   [[ "$VALIDATE_WRAPPER_PRESENT" == true ]] && \
   [[ "$DECK_ENTRY_PRESENT" == true ]] && \
   [[ "$TSCONFIG_PRESENT" == true ]]; then
  BOOTSTRAP_COMPLETE=true
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
  echo "    \"project_metadata_present\": ${PROJECT_METADATA_PRESENT},"
  echo "    \"package_json_present\": ${PACKAGE_JSON_PRESENT},"
  echo "    \"build_script_present\": ${BUILD_SCRIPT_PRESENT},"
  echo "    \"lint_script_present\": ${LINT_SCRIPT_PRESENT},"
  echo "    \"typecheck_script_present\": ${TYPECHECK_SCRIPT_PRESENT},"
  echo "    \"test_script_present\": ${TEST_SCRIPT_PRESENT},"
  echo "    \"validate_script_present\": ${VALIDATE_SCRIPT_PRESENT},"
    echo "    \"runner_present\": ${RUNNER_PRESENT},"
    echo "    \"validate_wrapper_present\": ${VALIDATE_WRAPPER_PRESENT},"
    echo "    \"deck_entry_present\": ${DECK_ENTRY_PRESENT},"
    echo "    \"tsconfig_present\": ${TSCONFIG_PRESENT},"
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
