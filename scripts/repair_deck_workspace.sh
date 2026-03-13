#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <project-dir>" >&2
}

if [[ "$#" -ne 1 ]]; then
  usage
  exit 1
fi

PROJECT_DIR="$(cd "$1" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

assert_not_project_root "$PROJECT_DIR" "$SCRIPT_DIR"

DECK_ROOT="$(find_deck_root_for_project "$PROJECT_DIR" || true)"
if [[ -z "$DECK_ROOT" ]]; then
  DECK_ROOT="$(infer_deck_root_from_project_dir "$PROJECT_DIR" || true)"
fi

if [[ -z "$DECK_ROOT" ]]; then
  echo "Could not infer a deck root for project directory: $PROJECT_DIR" >&2
  echo "Projects must live under <deck-root>/projects/<slug>." >&2
  exit 1
fi

STATE_FILE="${PROJECT_DIR}/.ai-native-slides/state.json"

echo "Bootstrapping shared deck root files..."
set +e
bash "${SCRIPT_DIR}/bootstrap_deck_root.sh" "$DECK_ROOT"
root_bootstrap_exit=$?
set -e

if [[ "$root_bootstrap_exit" -ne 0 ]]; then
  echo "Shared root bootstrap reported an incomplete root. Continuing with shared repairs..."
fi

echo "Bootstrapping project files..."
set +e
bash "${SCRIPT_DIR}/bootstrap_deck_workspace.sh" "$PROJECT_DIR"
project_bootstrap_exit=$?
set -e

if [[ "$project_bootstrap_exit" -ne 0 ]]; then
  echo "Project bootstrap reported an incomplete project. Continuing with shared repairs..."
fi

echo "Repairing shared root runtime..."
bash "${SCRIPT_DIR}/repair_deck_root.sh" "$DECK_ROOT"

echo "Refreshing project state..."
if bash "${SCRIPT_DIR}/ensure_deck_workspace.sh" "$PROJECT_DIR"; then
  echo "Project repair complete. Project is ready."
  exit 0
fi

echo "Project repair finished, but manual follow-up is still required." >&2
echo "See ${STATE_FILE}" >&2
exit 1
