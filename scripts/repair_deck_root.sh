#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-root>" >&2
}

if [[ "$#" -ne 1 ]]; then
  usage
  exit 1
fi

DECK_ROOT="$(mkdir -p "$1" && cd "$1" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

assert_not_project_dir "$DECK_ROOT" "$SCRIPT_DIR"

STATE_FILE="${DECK_ROOT}/.ai-native-slides/state.json"
NODE_MODULES_DIR="${DECK_ROOT}/node_modules"
VENV_PYTHON="${DECK_ROOT}/.venv/bin/python"
UV_CACHE_DIR="${DECK_ROOT}/.uv-cache"
NODE_INSTALL_BLOCKED=false

running_in_codex_shell() {
  [[ "${CODEX_SHELL:-}" == "1" ]] || [[ -n "${CODEX_THREAD_ID:-}" ]]
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

node_dependencies_installed() {
  [[ -d "$NODE_MODULES_DIR/pptxgenjs" ]] && \
  [[ -d "$NODE_MODULES_DIR/skia-canvas" ]] && \
  [[ -d "$NODE_MODULES_DIR/fontkit" ]] && \
  [[ -d "$NODE_MODULES_DIR/linebreak" ]] && \
  [[ -d "$NODE_MODULES_DIR/prismjs" ]] && \
  [[ -d "$NODE_MODULES_DIR/mathjax-full" ]] && \
  [[ -d "$NODE_MODULES_DIR/typescript" ]] && \
  [[ -d "$NODE_MODULES_DIR/tsx" ]] && \
  [[ -d "$NODE_MODULES_DIR/vitest" ]] && \
  [[ -d "$NODE_MODULES_DIR/@biomejs/biome" ]] && \
  [[ -d "$NODE_MODULES_DIR/@types/node" ]]
}

python_packages_installed() {
  [[ -x "$VENV_PYTHON" ]] && \
  "$VENV_PYTHON" -c "import PIL, pdf2image, pptx, numpy" >/dev/null 2>&1
}

run_uv() {
  (
    cd "$DECK_ROOT"
    UV_CACHE_DIR="$UV_CACHE_DIR" uv "$@"
  )
}

echo "Bootstrapping shared deck root files..."
set +e
bash "${SCRIPT_DIR}/bootstrap_deck_root.sh" "$DECK_ROOT"
bootstrap_exit=$?
set -e

if [[ "$bootstrap_exit" -ne 0 ]]; then
  echo "Root bootstrap reported an incomplete deck root. Continuing with shared runtime repairs..."
fi

require_command node
require_command pnpm
require_command uv
mkdir -p "$UV_CACHE_DIR"

if ! node_dependencies_installed; then
  if running_in_codex_shell; then
    NODE_INSTALL_BLOCKED=true
    echo "Shared Node dependencies must be installed from a local terminal when running inside Codex." >&2
    echo "The deck root is configured to keep pnpm packages in .pnpm-store via .npmrc." >&2
    echo "Run: cd \"$DECK_ROOT\" && pnpm install" >&2
  else
    echo "Installing shared Node dependencies with pnpm..."
    (
      cd "$DECK_ROOT"
      pnpm install
    )
  fi
else
  echo "Shared Node dependencies already installed."
fi

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Creating shared Python environment..."
  run_uv venv --python 3.12 .venv
else
  echo "Shared Python environment already exists."
fi

if ! python_packages_installed; then
  echo "Installing shared Python packages..."
  run_uv pip install --python .venv/bin/python Pillow pdf2image python-pptx numpy
else
  echo "Shared Python packages already installed."
fi

echo "Refreshing shared root state..."
if bash "${SCRIPT_DIR}/ensure_deck_root.sh" "$DECK_ROOT"; then
  echo "Shared root repair complete. Deck root is ready."
  exit 0
fi

if [[ "$NODE_INSTALL_BLOCKED" == true ]]; then
  echo "Shared root repair paused for human-in-the-loop Node install." >&2
  echo "See ${STATE_FILE}" >&2
  exit 1
fi

echo "Shared root repair finished, but manual follow-up is still required." >&2
echo "See ${STATE_FILE}" >&2
exit 1
