#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-workspace> [--quiet] [--json]" >&2
}

QUIET=0
JSON_ONLY=0
DECK_DIR=""

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
      if [[ -n "$DECK_DIR" ]]; then
        usage
        exit 1
      fi
      DECK_DIR="$arg"
      ;;
  esac
done

if [[ -z "$DECK_DIR" ]]; then
  usage
  exit 1
fi

DECK_DIR="$(cd "$DECK_DIR" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_DIR="${DECK_DIR}/.ai-native-slides"
STATE_FILE="${STATE_DIR}/state.json"
HELPERS_SRC="${SKILL_ROOT}/assets/pptxgenjs_helpers"
HELPERS_DEST="${DECK_DIR}/assets/pptxgenjs_helpers"
VALIDATE_DEST="${DECK_DIR}/validate-local.sh"
PACKAGE_TEMPLATE="${SKILL_ROOT}/assets/templates/package.json"
PACKAGE_JSON="${DECK_DIR}/package.json"
PNPM_LOCK="${DECK_DIR}/pnpm-lock.yaml"
DECK_JS="${DECK_DIR}/deck.js"
NODE_MODULES_DIR="${DECK_DIR}/node_modules"
VENV_PYTHON="${DECK_DIR}/.venv/bin/python"
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

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

dir_signature() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    printf 'missing'
    return
  fi

  local tmp_file
  tmp_file="$(mktemp)"
  while IFS= read -r file; do
    local rel="${file#"$dir"/}"
    local sum
    sum="$(shasum -a 256 "$file" | awk '{print $1}')"
    printf '%s  %s\n' "$sum" "$rel" >> "$tmp_file"
  done < <(find "$dir" -type f | sort)

  local combined
  combined="$(shasum -a 256 "$tmp_file" | awk '{print $1}')"
  rm -f "$tmp_file"
  printf '%s' "$combined"
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

declare -a MISSING_ITEMS=()
declare -a WARNINGS=()
declare -a SUGGESTIONS=()

SKILL_REVISION="$(
  git -C "$SKILL_ROOT" rev-parse --short HEAD 2>/dev/null || \
  shasum -a 256 "$SKILL_ROOT/SKILL.md" | awk '{print $1}'
)"

PNPM_PRESENT=false
if command_exists pnpm; then PNPM_PRESENT=true; else
  add_missing "pnpm is not installed or not on PATH"
  add_suggestion "Install pnpm and confirm \`pnpm --version\` works."
fi

NODE_PRESENT=false
if command_exists node; then NODE_PRESENT=true; else
  add_missing "node is not installed or not on PATH"
  add_suggestion "Install Node.js so \`pnpm build\` can run."
fi

UV_PRESENT=false
if command_exists uv; then UV_PRESENT=true; else
  add_missing "uv is not installed or not on PATH"
  add_suggestion "Install uv for deck-local Python environment management."
fi

SOFFICE_PRESENT=false
if command_exists soffice; then SOFFICE_PRESENT=true; else
  add_missing "LibreOffice soffice is not installed or not on PATH"
  add_suggestion "Install LibreOffice and confirm \`soffice --version\` works."
fi

PDFINFO_PRESENT=false
if command_exists pdfinfo; then PDFINFO_PRESENT=true; else
  add_missing "pdfinfo is not installed or not on PATH"
  add_suggestion "Install Poppler so \`pdfinfo\` is available."
fi

PDFTOPPM_PRESENT=false
if command_exists pdftoppm; then PDFTOPPM_PRESENT=true; else
  add_missing "pdftoppm is not installed or not on PATH"
  add_suggestion "Install Poppler so \`pdftoppm\` is available."
fi

PACKAGE_JSON_PRESENT=false
if [[ -f "$PACKAGE_JSON" ]]; then PACKAGE_JSON_PRESENT=true; else
  add_missing "package.json is missing"
  if [[ -f "$PACKAGE_TEMPLATE" ]]; then
    add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$DECK_DIR\"\` to scaffold package.json."
  fi
fi

PNPM_LOCK_PRESENT=false
if [[ -f "$PNPM_LOCK" ]]; then PNPM_LOCK_PRESENT=true; else
  add_warning "pnpm-lock.yaml is missing"
fi

DECK_JS_PRESENT=false
if [[ -f "$DECK_JS" ]]; then DECK_JS_PRESENT=true; else
  add_missing "deck.js is missing"
  add_suggestion "Create \`$DECK_JS\` before running \`pnpm build\`."
fi

BUILD_SCRIPT_PRESENT=false
if [[ -f "$PACKAGE_JSON" ]] && grep -Eq '"build"[[:space:]]*:' "$PACKAGE_JSON"; then
  BUILD_SCRIPT_PRESENT=true
else
  if [[ -f "$PACKAGE_JSON" ]]; then
    add_missing "package.json does not define a build script"
    add_suggestion "Add a \`build\` script such as \`node deck.js\` to package.json."
  fi
fi

HELPERS_PRESENT=false
if [[ -f "${HELPERS_DEST}/index.js" ]]; then HELPERS_PRESENT=true; else
  add_missing "deck helper assets are missing from assets/pptxgenjs_helpers"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$DECK_DIR\"\` to sync helper assets."
fi

VALIDATE_WRAPPER_PRESENT=false
if [[ -x "$VALIDATE_DEST" ]]; then VALIDATE_WRAPPER_PRESENT=true; else
  add_missing "validate-local.sh is missing or not executable"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$DECK_DIR\" --force\` to write validate-local.sh."
fi

HELPERS_SYNCED=false
SOURCE_HELPERS_SIGNATURE="$(dir_signature "$HELPERS_SRC")"
DEST_HELPERS_SIGNATURE="$(dir_signature "$HELPERS_DEST")"
if [[ "$SOURCE_HELPERS_SIGNATURE" != "missing" ]] && [[ "$SOURCE_HELPERS_SIGNATURE" == "$DEST_HELPERS_SIGNATURE" ]]; then
  HELPERS_SYNCED=true
else
  if [[ "$DEST_HELPERS_SIGNATURE" != "missing" ]]; then
    add_warning "deck helper assets differ from the installed skill helper assets"
    add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/bootstrap_deck_workspace.sh\" \"$DECK_DIR\" --force\` to resync helper assets."
  fi
fi

NODE_DEPS_PRESENT=false
if [[ -d "$NODE_MODULES_DIR/pptxgenjs" ]] && [[ -d "$NODE_MODULES_DIR/skia-canvas" ]] && [[ -d "$NODE_MODULES_DIR/fontkit" ]] && [[ -d "$NODE_MODULES_DIR/linebreak" ]] && [[ -d "$NODE_MODULES_DIR/prismjs" ]] && [[ -d "$NODE_MODULES_DIR/mathjax-full" ]]; then
  NODE_DEPS_PRESENT=true
else
  add_missing "Node dependencies are not fully installed in node_modules"
  add_suggestion "Run \`cd \"$DECK_DIR\" && pnpm install\`."
fi

VENV_PYTHON_PRESENT=false
if [[ -x "$VENV_PYTHON" ]]; then VENV_PYTHON_PRESENT=true; else
  add_missing "deck Python environment is missing at .venv/bin/python"
  add_suggestion "Run \`cd \"$DECK_DIR\" && uv venv --python 3.12 .venv\`."
fi

PYTHON_PACKAGES_PRESENT=false
if [[ -x "$VENV_PYTHON" ]] && "$VENV_PYTHON" -c "import PIL, pdf2image, pptx, numpy" >/dev/null 2>&1; then
  PYTHON_PACKAGES_PRESENT=true
else
  if [[ -x "$VENV_PYTHON" ]]; then
    add_missing "deck Python packages are incomplete"
    add_suggestion "Run \`cd \"$DECK_DIR\" && uv pip install --python .venv/bin/python Pillow pdf2image python-pptx numpy\`."
  fi
fi

SYSTEM_TOOLS_PRESENT=false
if [[ "$SOFFICE_PRESENT" == true ]] && [[ "$PDFINFO_PRESENT" == true ]] && [[ "$PDFTOPPM_PRESENT" == true ]]; then
  SYSTEM_TOOLS_PRESENT=true
fi

WORKSPACE_READY=false
if [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$DECK_JS_PRESENT" == true ]] && \
   [[ "$BUILD_SCRIPT_PRESENT" == true ]] && \
   [[ "$HELPERS_PRESENT" == true ]] && \
   [[ "$VALIDATE_WRAPPER_PRESENT" == true ]] && \
   [[ "$NODE_DEPS_PRESENT" == true ]] && \
   [[ "$VENV_PYTHON_PRESENT" == true ]] && \
   [[ "$PYTHON_PACKAGES_PRESENT" == true ]] && \
   [[ "$SYSTEM_TOOLS_PRESENT" == true ]]; then
   WORKSPACE_READY=true
fi

BOOTSTRAP_COMPLETE=false
if [[ "$HELPERS_PRESENT" == true ]] && [[ "$VALIDATE_WRAPPER_PRESENT" == true ]] && [[ "$PACKAGE_JSON_PRESENT" == true ]]; then
  BOOTSTRAP_COMPLETE=true
fi

if [[ "$WORKSPACE_READY" != true ]]; then
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/repair_deck_workspace.sh\" \"$DECK_DIR\"\` to auto-fix deck-local dependencies and refresh workspace state."
fi

{
  echo "{"
  echo "  \"skill_name\": \"ai-native-slides\","
  echo "  \"skill_dir\": \"$(json_escape "$SKILL_ROOT")\","
  echo "  \"skill_revision\": \"$(json_escape "$SKILL_REVISION")\","
  echo "  \"checked_at\": \"$(json_escape "$CHECKED_AT")\","
  echo "  \"workspace_path\": \"$(json_escape "$DECK_DIR")\","
  echo "  \"state_file\": \"$(json_escape "$STATE_FILE")\","
  echo "  \"bootstrap_complete\": ${BOOTSTRAP_COMPLETE},"
  echo "  \"workspace_ready\": ${WORKSPACE_READY},"
  echo "  \"status\": {"
  echo "    \"package_json_present\": ${PACKAGE_JSON_PRESENT},"
  echo "    \"pnpm_lock_present\": ${PNPM_LOCK_PRESENT},"
  echo "    \"deck_js_present\": ${DECK_JS_PRESENT},"
  echo "    \"build_script_present\": ${BUILD_SCRIPT_PRESENT},"
  echo "    \"helpers_present\": ${HELPERS_PRESENT},"
  echo "    \"helpers_synced\": ${HELPERS_SYNCED},"
  echo "    \"validate_wrapper_present\": ${VALIDATE_WRAPPER_PRESENT},"
  echo "    \"node_dependencies_installed\": ${NODE_DEPS_PRESENT},"
  echo "    \"venv_python_present\": ${VENV_PYTHON_PRESENT},"
  echo "    \"python_packages_installed\": ${PYTHON_PACKAGES_PRESENT},"
  echo "    \"system_tools_present\": ${SYSTEM_TOOLS_PRESENT}"
  echo "  },"
  echo "  \"tools\": {"
  echo "    \"node_present\": ${NODE_PRESENT},"
  echo "    \"pnpm_present\": ${PNPM_PRESENT},"
  echo "    \"uv_present\": ${UV_PRESENT},"
  echo "    \"soffice_present\": ${SOFFICE_PRESENT},"
  echo "    \"pdfinfo_present\": ${PDFINFO_PRESENT},"
  echo "    \"pdftoppm_present\": ${PDFTOPPM_PRESENT}"
  echo "  },"
  echo "  \"helpers\": {"
  echo "    \"source_signature\": \"$(json_escape "$SOURCE_HELPERS_SIGNATURE")\","
  echo "    \"workspace_signature\": \"$(json_escape "$DEST_HELPERS_SIGNATURE")\""
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
fi

if [[ "$JSON_ONLY" -eq 0 ]]; then
  if [[ "$WORKSPACE_READY" == true ]]; then
    if [[ "$QUIET" -ne 1 ]]; then
      echo "Workspace ready: ${DECK_DIR}"
      echo "State file: ${STATE_FILE}"
    fi
  else
    echo "Workspace incomplete: ${DECK_DIR}" >&2
    echo "State file: ${STATE_FILE}" >&2
    if [[ "${#MISSING_ITEMS[@]}" -gt 0 ]]; then
      for item in "${MISSING_ITEMS[@]}"; do
        echo "- Missing: ${item}" >&2
      done
    fi
    if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
      for item in "${WARNINGS[@]}"; do
        echo "- Warning: ${item}" >&2
      done
    fi
    if [[ "${#SUGGESTIONS[@]}" -gt 0 ]]; then
      echo "Suggested next steps:" >&2
      for item in "${SUGGESTIONS[@]}"; do
        echo "- ${item}" >&2
      done
    fi
  fi
fi

if [[ "$WORKSPACE_READY" == true ]]; then
  exit 0
fi

exit 1
