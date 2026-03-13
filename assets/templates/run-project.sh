#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <build|lint|format|typecheck|test|test:watch>" >&2
}

if [[ "$#" -ne 1 ]]; then
  usage
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="$1"

find_deck_root() {
  local current_dir
  current_dir="$1"

  while [[ "$current_dir" != "/" ]]; do
    if [[ -f "$current_dir/.ai-native-slides/root.json" ]]; then
      printf '%s' "$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done

  return 1
}

DECK_ROOT="$(find_deck_root "$PROJECT_DIR" || true)"
if [[ -z "$DECK_ROOT" ]]; then
  echo "Could not find the shared deck root for project: $PROJECT_DIR" >&2
  exit 1
fi

BIN_DIR="$DECK_ROOT/node_modules/.bin"
if [[ ! -d "$BIN_DIR" ]]; then
  echo "Missing shared node_modules at: $DECK_ROOT/node_modules" >&2
  echo "Run 'pnpm install' in the deck root from a local terminal first." >&2
  exit 1
fi

case "$ACTION" in
  build)
    (
      cd "$PROJECT_DIR"
      "$BIN_DIR/tsx" src/main.ts
    )
    ;;
  lint)
    "$BIN_DIR/biome" check "$PROJECT_DIR/src" "$PROJECT_DIR/tests"
    ;;
  format)
    "$BIN_DIR/biome" check --write "$PROJECT_DIR/src" "$PROJECT_DIR/tests"
    ;;
  typecheck)
    "$BIN_DIR/tsc" --noEmit -p "$PROJECT_DIR/tsconfig.json"
    ;;
  test)
    (
      cd "$PROJECT_DIR"
      "$BIN_DIR/vitest" run
    )
    ;;
  test:watch)
    (
      cd "$PROJECT_DIR"
      "$BIN_DIR/vitest"
    )
    ;;
  *)
    usage
    exit 1
    ;;
esac
