#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <project-dir> [--dry-run]" >&2
}

DRY_RUN=0
PROJECT_DIR=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPTS_DIR}/project_lib.sh"

assert_not_project_root "$PROJECT_DIR" "$SCRIPT_DIR"

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

legacy_targets=(
  "$PROJECT_DIR/rendered"
  "$PROJECT_DIR/output/rendered"
  "$PROJECT_DIR/node_modules/.vite"
  "$PROJECT_DIR/node_modules/.vite-temp"
)

found_targets=0

for target in "${legacy_targets[@]}"; do
  if [[ -e "$target" ]]; then
    found_targets=1
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "Would remove $target"
    else
      rm -rf "$target"
      echo "Removed $target"
    fi
  fi
done

if [[ -d "$PROJECT_DIR/node_modules" ]] && [[ -z "$(find "$PROJECT_DIR/node_modules" -mindepth 1 -print -quit)" ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Would remove empty $PROJECT_DIR/node_modules"
  else
    rmdir "$PROJECT_DIR/node_modules"
    echo "Removed empty $PROJECT_DIR/node_modules"
  fi
fi

if [[ "$found_targets" -eq 0 ]]; then
  echo "No legacy cleanup targets found under $PROJECT_DIR"
fi
