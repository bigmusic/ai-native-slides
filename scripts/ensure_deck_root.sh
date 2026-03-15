#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-root> [--quiet] [--json]" >&2
}

QUIET=0
JSON_ONLY=0
DECK_ROOT=""

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
      if [[ -n "$DECK_ROOT" ]]; then
        usage
        exit 1
      fi
      DECK_ROOT="$arg"
      ;;
  esac
done

if [[ -z "$DECK_ROOT" ]]; then
  usage
  exit 1
fi

DECK_ROOT="$(cd "$DECK_ROOT" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

assert_not_project_dir "$DECK_ROOT" "$SCRIPT_DIR"

STATE_DIR="${DECK_ROOT}/.ai-native-slides"
STATE_FILE="${STATE_DIR}/state.json"
ROOT_METADATA_FILE="$(root_metadata_path "$DECK_ROOT")"
ROOT_TEMPLATE_DIR="${SKILL_ROOT}/assets/root_templates"
ROOT_GITIGNORE_TEMPLATE="${ROOT_TEMPLATE_DIR}/.gitignore"
ROOT_NPMRC_TEMPLATE="${ROOT_TEMPLATE_DIR}/.npmrc"
ROOT_PACKAGE_TEMPLATE="${ROOT_TEMPLATE_DIR}/package.json"
HELPERS_SRC="${SKILL_ROOT}/assets/pptxgenjs_helpers"
HELPERS_DEST="${DECK_ROOT}/assets/pptxgenjs_helpers"
ROOT_GITIGNORE="${DECK_ROOT}/.gitignore"
PACKAGE_JSON="${DECK_ROOT}/package.json"
NPMRC_FILE="${DECK_ROOT}/.npmrc"
PNPM_LOCK="${DECK_ROOT}/pnpm-lock.yaml"
BIOME_CONFIG="${DECK_ROOT}/biome.jsonc"
TSCONFIG_BASE="${DECK_ROOT}/tsconfig.base.json"
NODE_MODULES_DIR="${DECK_ROOT}/node_modules"
VENV_PYTHON="${DECK_ROOT}/.venv/bin/python"
CHECKED_AT="$(date '+%Y-%m-%dT%H:%M:%S%z')"

mkdir -p "$STATE_DIR"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

template_file_matches() {
  local template_path="$1"
  local dest_path="$2"
  [[ -f "$template_path" ]] && [[ -f "$dest_path" ]] && cmp -s "$template_path" "$dest_path"
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

SKILL_REVISION="$(resolve_skill_revision "$SKILL_ROOT")"
SKILL_WORKTREE_DIRTY=false
if skill_worktree_dirty "$SKILL_ROOT"; then
  SKILL_WORKTREE_DIRTY=true
fi

ROOT_METADATA_PRESENT=false
if [[ -f "$ROOT_METADATA_FILE" ]]; then ROOT_METADATA_PRESENT=true; else
  add_missing "deck root metadata is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to initialize the shared deck root."
fi

ROOT_GITIGNORE_PRESENT=false
if [[ -f "$ROOT_GITIGNORE" ]]; then ROOT_GITIGNORE_PRESENT=true; else
  add_missing "root .gitignore is missing"
fi

PNPM_PRESENT=false
if command_exists pnpm; then PNPM_PRESENT=true; else
  add_missing "pnpm is not installed or not on PATH"
  add_suggestion "Install pnpm and confirm \`pnpm --version\` works."
fi

NODE_PRESENT=false
if command_exists node; then NODE_PRESENT=true; else
  add_missing "node is not installed or not on PATH"
  add_suggestion "Install Node.js so shared deck tooling can run."
fi

UV_PRESENT=false
if command_exists uv; then UV_PRESENT=true; else
  add_missing "uv is not installed or not on PATH"
  add_suggestion "Install uv for the shared Python environment."
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
  add_missing "root package.json is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to scaffold the shared root package."
fi

NPMRC_PRESENT=false
if [[ -f "$NPMRC_FILE" ]]; then NPMRC_PRESENT=true; else
  add_missing "root .npmrc is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to restore the deck-root pnpm store config."
fi

LOCAL_PNPM_STORE_CONFIGURED=false
if [[ -f "$NPMRC_FILE" ]] && grep -Eq '^[[:space:]]*store-dir[[:space:]]*=[[:space:]]*\.pnpm-store[[:space:]]*$' "$NPMRC_FILE"; then
  LOCAL_PNPM_STORE_CONFIGURED=true
else
  if [[ "$NPMRC_PRESENT" == true ]]; then
    add_missing "root .npmrc does not configure \`store-dir=.pnpm-store\`"
    add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to restore the deck-root pnpm store config."
  fi
fi

PNPM_LOCK_PRESENT=false
if [[ -f "$PNPM_LOCK" ]]; then PNPM_LOCK_PRESENT=true; else
  add_warning "pnpm-lock.yaml is missing at the deck root"
fi

BIOME_PRESENT=false
if [[ -f "$BIOME_CONFIG" ]]; then BIOME_PRESENT=true; else
  add_missing "root biome.jsonc is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to refresh shared config."
fi

TSCONFIG_BASE_PRESENT=false
if [[ -f "$TSCONFIG_BASE" ]]; then TSCONFIG_BASE_PRESENT=true; else
  add_missing "root tsconfig.base.json is missing"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to refresh shared config."
fi

HELPERS_PRESENT=false
if [[ -f "${HELPERS_DEST}/index.js" ]]; then HELPERS_PRESENT=true; else
  add_missing "shared helper assets are missing from assets/pptxgenjs_helpers"
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to sync shared helpers."
fi

ROOT_GITIGNORE_SYNCED=false
if template_file_matches "$ROOT_GITIGNORE_TEMPLATE" "$ROOT_GITIGNORE"; then
  ROOT_GITIGNORE_SYNCED=true
elif [[ "$ROOT_GITIGNORE_PRESENT" == true ]]; then
  add_warning "root .gitignore differs from the template-managed version"
fi

PACKAGE_JSON_SYNCED=false
if template_file_matches "$ROOT_PACKAGE_TEMPLATE" "$PACKAGE_JSON"; then
  PACKAGE_JSON_SYNCED=true
elif [[ "$PACKAGE_JSON_PRESENT" == true ]]; then
  add_warning "root package.json differs from the template-managed version"
fi

NPMRC_SYNCED=false
if template_file_matches "$ROOT_NPMRC_TEMPLATE" "$NPMRC_FILE"; then
  NPMRC_SYNCED=true
elif [[ "$NPMRC_PRESENT" == true ]]; then
  add_warning "root .npmrc differs from the template-managed version"
fi

BIOME_SYNCED=false
if template_file_matches "$SKILL_ROOT/biome.jsonc" "$BIOME_CONFIG"; then
  BIOME_SYNCED=true
elif [[ "$BIOME_PRESENT" == true ]]; then
  add_warning "root biome.jsonc differs from the template-managed version"
fi

TSCONFIG_BASE_SYNCED=false
if template_file_matches "$SKILL_ROOT/tsconfig.base.json" "$TSCONFIG_BASE"; then
  TSCONFIG_BASE_SYNCED=true
elif [[ "$TSCONFIG_BASE_PRESENT" == true ]]; then
  add_warning "root tsconfig.base.json differs from the template-managed version"
fi

HELPERS_SYNCED=false
SOURCE_HELPERS_SIGNATURE="$(dir_signature "$HELPERS_SRC")"
DEST_HELPERS_SIGNATURE="$(dir_signature "$HELPERS_DEST")"
if [[ "$SOURCE_HELPERS_SIGNATURE" != "missing" ]] && [[ "$SOURCE_HELPERS_SIGNATURE" == "$DEST_HELPERS_SIGNATURE" ]]; then
  HELPERS_SYNCED=true
else
  if [[ "$DEST_HELPERS_SIGNATURE" != "missing" ]]; then
    add_warning "shared helper assets differ from the installed skill helper assets"
    add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to resync shared helpers."
  fi
fi

NODE_DEPS_PRESENT=false
if [[ -d "$NODE_MODULES_DIR/@google" ]] && \
   [[ -d "$NODE_MODULES_DIR/@google/genai" ]] && \
   [[ -d "$NODE_MODULES_DIR/ajv" ]] && \
   [[ -d "$NODE_MODULES_DIR/pptxgenjs" ]] && \
   [[ -d "$NODE_MODULES_DIR/skia-canvas" ]] && \
   [[ -d "$NODE_MODULES_DIR/sharp" ]] && \
   [[ -d "$NODE_MODULES_DIR/fontkit" ]] && \
   [[ -d "$NODE_MODULES_DIR/linebreak" ]] && \
   [[ -d "$NODE_MODULES_DIR/prismjs" ]] && \
   [[ -d "$NODE_MODULES_DIR/mathjax-full" ]] && \
   [[ -d "$NODE_MODULES_DIR/typescript" ]] && \
   [[ -d "$NODE_MODULES_DIR/tsx" ]] && \
   [[ -d "$NODE_MODULES_DIR/vitest" ]] && \
   [[ -d "$NODE_MODULES_DIR/@biomejs/biome" ]] && \
   [[ -d "$NODE_MODULES_DIR/@types/node" ]]; then
  NODE_DEPS_PRESENT=true
else
  add_missing "shared Node dependencies are not fully installed in root node_modules"
  add_suggestion "Run \`cd \"$DECK_ROOT\" && pnpm install\` so shared Node dependencies use the deck-root \`.pnpm-store/\` configured in \`.npmrc\`."
fi

VENV_PYTHON_PRESENT=false
if [[ -x "$VENV_PYTHON" ]]; then VENV_PYTHON_PRESENT=true; else
  add_missing "shared Python environment is missing at .venv/bin/python"
  add_suggestion "Run \`cd \"$DECK_ROOT\" && UV_CACHE_DIR=.uv-cache uv venv --python 3.12 .venv\` to keep uv cache inside the deck root."
fi

PYTHON_PACKAGES_PRESENT=false
if [[ -x "$VENV_PYTHON" ]] && "$VENV_PYTHON" -c "import PIL, pdf2image, pptx, numpy" >/dev/null 2>&1; then
  PYTHON_PACKAGES_PRESENT=true
else
  if [[ -x "$VENV_PYTHON" ]]; then
    add_missing "shared Python packages are incomplete"
    add_suggestion "Run \`cd \"$DECK_ROOT\" && UV_CACHE_DIR=.uv-cache uv pip install --python .venv/bin/python Pillow pdf2image python-pptx numpy\` to keep uv cache inside the deck root."
  fi
fi

SYSTEM_TOOLS_PRESENT=false
if [[ "$SOFFICE_PRESENT" == true ]] && [[ "$PDFINFO_PRESENT" == true ]] && [[ "$PDFTOPPM_PRESENT" == true ]]; then
  SYSTEM_TOOLS_PRESENT=true
fi

ROOT_READY=false
if [[ "$ROOT_METADATA_PRESENT" == true ]] && \
   [[ "$ROOT_GITIGNORE_PRESENT" == true ]] && \
   [[ "$ROOT_GITIGNORE_SYNCED" == true ]] && \
   [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$PACKAGE_JSON_SYNCED" == true ]] && \
   [[ "$NPMRC_PRESENT" == true ]] && \
   [[ "$NPMRC_SYNCED" == true ]] && \
   [[ "$LOCAL_PNPM_STORE_CONFIGURED" == true ]] && \
   [[ "$BIOME_PRESENT" == true ]] && \
   [[ "$BIOME_SYNCED" == true ]] && \
   [[ "$TSCONFIG_BASE_PRESENT" == true ]] && \
   [[ "$TSCONFIG_BASE_SYNCED" == true ]] && \
   [[ "$HELPERS_PRESENT" == true ]] && \
   [[ "$HELPERS_SYNCED" == true ]] && \
   [[ "$NODE_DEPS_PRESENT" == true ]] && \
   [[ "$VENV_PYTHON_PRESENT" == true ]] && \
   [[ "$PYTHON_PACKAGES_PRESENT" == true ]] && \
   [[ "$SYSTEM_TOOLS_PRESENT" == true ]]; then
  ROOT_READY=true
fi

BOOTSTRAP_COMPLETE=false
if [[ "$ROOT_METADATA_PRESENT" == true ]] && \
   [[ "$ROOT_GITIGNORE_PRESENT" == true ]] && \
   [[ "$ROOT_GITIGNORE_SYNCED" == true ]] && \
   [[ "$PACKAGE_JSON_PRESENT" == true ]] && \
   [[ "$PACKAGE_JSON_SYNCED" == true ]] && \
   [[ "$NPMRC_PRESENT" == true ]] && \
   [[ "$NPMRC_SYNCED" == true ]] && \
   [[ "$LOCAL_PNPM_STORE_CONFIGURED" == true ]] && \
   [[ "$BIOME_PRESENT" == true ]] && \
   [[ "$BIOME_SYNCED" == true ]] && \
   [[ "$TSCONFIG_BASE_PRESENT" == true ]] && \
   [[ "$TSCONFIG_BASE_SYNCED" == true ]] && \
   [[ "$HELPERS_PRESENT" == true ]] && \
   [[ "$HELPERS_SYNCED" == true ]]; then
  BOOTSTRAP_COMPLETE=true
fi

if [[ "$ROOT_READY" != true ]]; then
  add_suggestion "Run \`bash \"$SKILL_ROOT/scripts/init_deck_root.sh\" \"$DECK_ROOT\"\` to auto-fix shared dependencies and refresh root state."
fi

{
  echo "{"
  echo "  \"skill_name\": \"ai-native-slides\","
  echo "  \"skill_dir\": \"$(json_escape "$SKILL_ROOT")\","
  echo "  \"skill_revision\": \"$(json_escape "$SKILL_REVISION")\","
  echo "  \"skill_worktree_dirty\": ${SKILL_WORKTREE_DIRTY},"
  echo "  \"checked_at\": \"$(json_escape "$CHECKED_AT")\","
  echo "  \"deck_root\": \"$(json_escape "$DECK_ROOT")\","
  echo "  \"state_file\": \"$(json_escape "$STATE_FILE")\","
  echo "  \"bootstrap_complete\": ${BOOTSTRAP_COMPLETE},"
  echo "  \"root_ready\": ${ROOT_READY},"
  echo "  \"status\": {"
  echo "    \"root_metadata_present\": ${ROOT_METADATA_PRESENT},"
  echo "    \"root_gitignore_present\": ${ROOT_GITIGNORE_PRESENT},"
  echo "    \"root_gitignore_synced\": ${ROOT_GITIGNORE_SYNCED},"
  echo "    \"package_json_present\": ${PACKAGE_JSON_PRESENT},"
  echo "    \"package_json_synced\": ${PACKAGE_JSON_SYNCED},"
  echo "    \"npmrc_present\": ${NPMRC_PRESENT},"
  echo "    \"npmrc_synced\": ${NPMRC_SYNCED},"
  echo "    \"local_pnpm_store_configured\": ${LOCAL_PNPM_STORE_CONFIGURED},"
  echo "    \"pnpm_lock_present\": ${PNPM_LOCK_PRESENT},"
  echo "    \"biome_present\": ${BIOME_PRESENT},"
  echo "    \"biome_synced\": ${BIOME_SYNCED},"
  echo "    \"tsconfig_base_present\": ${TSCONFIG_BASE_PRESENT},"
  echo "    \"tsconfig_base_synced\": ${TSCONFIG_BASE_SYNCED},"
  echo "    \"helpers_present\": ${HELPERS_PRESENT},"
  echo "    \"helpers_synced\": ${HELPERS_SYNCED},"
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
  echo "    \"root_signature\": \"$(json_escape "$DEST_HELPERS_SIGNATURE")\""
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

if [[ "$ROOT_READY" == true ]]; then
  if [[ "$QUIET" -ne 1 ]]; then
    echo "Deck root ready: $DECK_ROOT"
    echo "State file: $STATE_FILE"
  fi
  exit 0
fi

if [[ "$QUIET" -ne 1 ]]; then
  echo "Deck root incomplete: $DECK_ROOT"
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
