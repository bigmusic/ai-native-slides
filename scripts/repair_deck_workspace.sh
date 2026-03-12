#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-workspace>" >&2
}

if [[ "$#" -ne 1 ]]; then
  usage
  exit 1
fi

DECK_DIR="$(cd "$1" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_FILE="${DECK_DIR}/.ai-native-slides/state.json"
WORKSPACE_STATE_DIR="${DECK_DIR}/.ai-native-slides"
PACKAGE_JSON="${DECK_DIR}/package.json"
NODE_MODULES_DIR="${DECK_DIR}/node_modules"
VENV_PYTHON="${DECK_DIR}/.venv/bin/python"

export UV_CACHE_DIR="${AI_NATIVE_SLIDES_UV_CACHE_DIR:-${WORKSPACE_STATE_DIR}/uv-cache}"
export UV_PYTHON_CACHE_DIR="${AI_NATIVE_SLIDES_UV_PYTHON_CACHE_DIR:-${WORKSPACE_STATE_DIR}/uv-python-cache}"
export UV_PYTHON_INSTALL_DIR="${AI_NATIVE_SLIDES_UV_PYTHON_INSTALL_DIR:-${WORKSPACE_STATE_DIR}/uv-python-install}"

mkdir -p "$WORKSPACE_STATE_DIR" "$UV_CACHE_DIR" "$UV_PYTHON_CACHE_DIR" "$UV_PYTHON_INSTALL_DIR"

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
  [[ -d "$NODE_MODULES_DIR/mathjax-full" ]]
}

python_packages_installed() {
  [[ -x "$VENV_PYTHON" ]] && \
  "$VENV_PYTHON" -c "import PIL, pdf2image, pptx, numpy" >/dev/null 2>&1
}

echo "Bootstrapping workspace files..."
set +e
bash "${SCRIPT_DIR}/bootstrap_deck_workspace.sh" "$DECK_DIR"
bootstrap_exit=$?
set -e

if [[ "$bootstrap_exit" -ne 0 ]]; then
  echo "Bootstrap reported an incomplete workspace. Continuing with local repairs..."
fi

require_command node
require_command pnpm
require_command uv

if [[ ! -f "$PACKAGE_JSON" ]]; then
  echo "Missing ${PACKAGE_JSON} after bootstrap." >&2
  exit 1
fi

if ! node_dependencies_installed; then
  echo "Installing Node dependencies with pnpm..."
  (
    cd "$DECK_DIR"
    pnpm install
  )
else
  echo "Node dependencies already installed."
fi

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Creating deck Python environment..."
  (
    cd "$DECK_DIR"
    uv venv --python 3.12 .venv
  )
else
  echo "Deck Python environment already exists."
fi

if ! python_packages_installed; then
  echo "Installing deck Python packages..."
  (
    cd "$DECK_DIR"
    uv pip install --python .venv/bin/python Pillow pdf2image python-pptx numpy
  )
else
  echo "Deck Python packages already installed."
fi

echo "Refreshing workspace state..."
if bash "${SCRIPT_DIR}/ensure_deck_workspace.sh" "$DECK_DIR"; then
  echo "Repair complete. Workspace is ready."
  exit 0
fi

echo "Repair finished, but manual follow-up is still required." >&2
echo "See ${STATE_FILE}" >&2
exit 1
