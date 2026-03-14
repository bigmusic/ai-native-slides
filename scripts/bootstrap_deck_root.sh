#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-root> [--force]" >&2
}

FORCE=0
DECK_ROOT=""

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=1
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

DECK_ROOT="$(mkdir -p "$DECK_ROOT" && cd "$DECK_ROOT" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

assert_not_project_dir "$DECK_ROOT" "$SCRIPT_DIR"

ROOT_TEMPLATE_DIR="${SKILL_ROOT}/assets/root_templates"
ROOT_GITIGNORE_TEMPLATE="${ROOT_TEMPLATE_DIR}/.gitignore"
ROOT_NPMRC_TEMPLATE="${ROOT_TEMPLATE_DIR}/.npmrc"
ROOT_PACKAGE_TEMPLATE="${ROOT_TEMPLATE_DIR}/package.json"
ROOT_GITIGNORE_DEST="${DECK_ROOT}/.gitignore"
ROOT_NPMRC_DEST="${DECK_ROOT}/.npmrc"
ROOT_PACKAGE_JSON="${DECK_ROOT}/package.json"
HELPERS_SRC="${SKILL_ROOT}/assets/pptxgenjs_helpers"
HELPERS_DEST="${DECK_ROOT}/assets/pptxgenjs_helpers"
BIOME_TEMPLATE="${SKILL_ROOT}/biome.jsonc"
BIOME_DEST="${DECK_ROOT}/biome.jsonc"
TSCONFIG_BASE_TEMPLATE="${SKILL_ROOT}/tsconfig.base.json"
TSCONFIG_BASE_DEST="${DECK_ROOT}/tsconfig.base.json"

sync_managed_file() {
  local src="$1"
  local dest="$2"
  local existed_before=false

  if [[ -e "$dest" ]]; then
    existed_before=true
  fi

  if [[ -f "$dest" ]] && cmp -s "$src" "$dest"; then
    echo "Up-to-date ${dest}"
    return
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  if [[ "$existed_before" == true ]]; then
    echo "Refreshed ${dest}"
  else
    echo "Wrote ${dest}"
  fi
}

mkdir -p "${DECK_ROOT}/assets" "${DECK_ROOT}/projects" "${DECK_ROOT}/.ai-native-slides"

if [[ -f "$ROOT_PACKAGE_TEMPLATE" ]]; then
  sync_managed_file "$ROOT_PACKAGE_TEMPLATE" "$ROOT_PACKAGE_JSON"
fi

if [[ -f "$ROOT_GITIGNORE_TEMPLATE" ]]; then
  sync_managed_file "$ROOT_GITIGNORE_TEMPLATE" "$ROOT_GITIGNORE_DEST"
fi

if [[ -f "$ROOT_NPMRC_TEMPLATE" ]]; then
  sync_managed_file "$ROOT_NPMRC_TEMPLATE" "$ROOT_NPMRC_DEST"
fi

if [[ -f "$BIOME_TEMPLATE" ]]; then
  sync_managed_file "$BIOME_TEMPLATE" "$BIOME_DEST"
fi

if [[ -f "$TSCONFIG_BASE_TEMPLATE" ]]; then
  sync_managed_file "$TSCONFIG_BASE_TEMPLATE" "$TSCONFIG_BASE_DEST"
fi

rsync -a --delete "${HELPERS_SRC}/" "${HELPERS_DEST}/"
write_root_metadata "$DECK_ROOT"

echo "Synced shared helper assets to ${HELPERS_DEST}"
bash "${SCRIPT_DIR}/ensure_deck_root.sh" "${DECK_ROOT}"
