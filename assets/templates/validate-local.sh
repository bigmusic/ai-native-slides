#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$PROJECT_DIR/tmp"
OUTPUT_DIR="$PROJECT_DIR/output"
RUN_PROJECT_SCRIPT="$PROJECT_DIR/run-project.sh"
PROJECT_STATE_FILE="$PROJECT_DIR/.ai-native-slides/state.json"

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

ROOT_STATE_FILE="$DECK_ROOT/.ai-native-slides/state.json"
VENV_PYTHON="$DECK_ROOT/.venv/bin/python"
LOCAL_SKILL_DIR="$(cd "$DECK_ROOT/.." && pwd)/ai-native-slides"
INSTALLED_SKILL_DIR="$HOME/.codex/skills/ai-native-slides"

pick_default_pptx() {
  local candidates=()

  if [[ ! -d "$OUTPUT_DIR" ]]; then
    printf '%s\n' "$OUTPUT_DIR/deck.pptx"
    return
  fi

  shopt -s nullglob
  candidates=("$OUTPUT_DIR"/*.pptx)
  shopt -u nullglob

  if [[ ${#candidates[@]} -eq 0 ]]; then
    printf '%s\n' "$OUTPUT_DIR/deck.pptx"
    return
  fi

  if [[ ${#candidates[@]} -eq 1 ]]; then
    printf '%s\n' "${candidates[0]}"
    return
  fi

  /bin/ls -t "${candidates[@]}" | head -n 1
}

if [[ $# -ge 1 ]]; then
  PPTX_PATH="$1"
else
  PPTX_PATH="$(pick_default_pptx)"
fi

PPTX_BASENAME="$(basename "$PPTX_PATH")"
PPTX_STEM="${PPTX_BASENAME%.pptx}"
RENDERED_DIR="$OUTPUT_DIR/${PPTX_STEM}-rendered"
REPORT_PATH="$OUTPUT_DIR/${PPTX_STEM}-validation.md"
FONT_JSON_PATH="$OUTPUT_DIR/${PPTX_STEM}-font-report.json"
MONTAGE_PATH="$OUTPUT_DIR/${PPTX_STEM}-montage.png"

if [[ -n "${AI_NATIVE_SLIDES_SKILL_DIR:-}" ]]; then
  SKILL_DIR="$AI_NATIVE_SLIDES_SKILL_DIR"
elif [[ -d "$LOCAL_SKILL_DIR/scripts" ]]; then
  SKILL_DIR="$LOCAL_SKILL_DIR"
else
  SKILL_DIR="$INSTALLED_SKILL_DIR"
fi

SKILL_SCRIPTS_DIR="$SKILL_DIR/scripts"
FAILED_STEPS=0
BLOCKED_STEPS=0
SKIPPED_STEPS=0
declare -a FAILED_TITLES=()
declare -a BLOCKED_TITLES=()
declare -a SKIPPED_TITLES=()
LAST_EXIT_CODE=0
LAST_OUTPUT_TEXT=""

if [[ ! -x "$RUN_PROJECT_SCRIPT" ]]; then
  echo "Missing project runner script: $RUN_PROJECT_SCRIPT" >&2
  exit 1
fi

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing shared deck venv python: $VENV_PYTHON" >&2
  echo "Run the root repair flow first." >&2
  exit 1
fi

if [[ ! -f "$PPTX_PATH" ]]; then
  echo "Missing deck artifact: $PPTX_PATH" >&2
  echo "Run 'pnpm build' in the project first, or pass an explicit .pptx path to validate-local.sh." >&2
  exit 1
fi

if [[ ! -d "$SKILL_SCRIPTS_DIR" ]]; then
  echo "Missing skill scripts: $SKILL_SCRIPTS_DIR" >&2
  echo "Set AI_NATIVE_SLIDES_SKILL_DIR or ensure a local skill repo exists at $LOCAL_SKILL_DIR." >&2
  exit 1
fi

if ! bash "$SKILL_SCRIPTS_DIR/ensure_deck_root.sh" "$DECK_ROOT" --quiet; then
  echo "Deck root preflight failed. See $ROOT_STATE_FILE." >&2
  exit 1
fi

if ! bash "$SKILL_SCRIPTS_DIR/ensure_deck_workspace.sh" "$PROJECT_DIR" --quiet; then
  echo "Project preflight failed. See $PROJECT_STATE_FILE." >&2
  exit 1
fi

export TMPDIR="$TMP_DIR"
export TMP="$TMP_DIR"
export TEMP="$TMP_DIR"
export SAL_USE_VCLPLUGIN="svp"

mkdir -p "$TMP_DIR" "$RENDERED_DIR" "$OUTPUT_DIR"

rm -f "$REPORT_PATH" "$FONT_JSON_PATH" "$MONTAGE_PATH"
rm -f "$RENDERED_DIR"/slide-*.png

cat <<REPORT > "$REPORT_PATH"
# Local Validation Report

- Generated at: $(date '+%Y-%m-%d %H:%M:%S %z')
- Deck root: $DECK_ROOT
- Project dir: $PROJECT_DIR
- TMPDIR: $TMPDIR
- Skill dir: $SKILL_DIR
- PPTX: $PPTX_PATH
- Root state: $ROOT_STATE_FILE
- Project state: $PROJECT_STATE_FILE
- Human-in-the-loop note: if LibreOffice \`soffice\` aborts in a sandboxed Codex session, rerun the render-dependent steps from your own terminal.

REPORT

append_section() {
  local title="$1"
  local command_text="$2"
  local output_file="$3"
  local exit_code="$4"

  {
    echo "## $title"
    echo
    echo '```bash'
    echo "$command_text"
    echo '```'
    echo
    echo "- Exit code: $exit_code"
    echo
    echo '```text'
    cat "$output_file"
    echo '```'
    echo
  } >> "$REPORT_PATH"
}

append_skipped_section() {
  local title="$1"
  local reason="$2"

  {
    echo "## $title"
    echo
    echo "- Status: SKIPPED"
    echo "- Reason: $reason"
    echo
  } >> "$REPORT_PATH"
}

record_failure() {
  local title="$1"
  FAILED_STEPS=$((FAILED_STEPS + 1))
  FAILED_TITLES+=("$title")
}

record_blocked() {
  local title="$1"
  BLOCKED_STEPS=$((BLOCKED_STEPS + 1))
  BLOCKED_TITLES+=("$title")
}

record_skipped() {
  local title="$1"
  SKIPPED_STEPS=$((SKIPPED_STEPS + 1))
  SKIPPED_TITLES+=("$title")
}

looks_like_human_in_loop_blocker() {
  local text="$1"
  [[ "$text" == *"Abort trap: 6"* ]] || \
  [[ "$text" == *"LibreOffice appears to have aborted"* ]] || \
  [[ "$text" == *"Re-run the render-dependent validation from a local terminal."* ]]
}

run_and_capture() {
  local title="$1"
  shift
  local cmd=("$@")
  local output_file
  local exit_code
  local output_text
  output_file="$(mktemp "$TMPDIR/${title// /_}.XXXXXX.log")"

  set +e
  "${cmd[@]}" >"$output_file" 2>&1
  exit_code=$?
  set -e

  output_text="$(cat "$output_file")"
  LAST_OUTPUT_TEXT="$output_text"
  LAST_EXIT_CODE=$exit_code
  append_section "$title" "${cmd[*]}" "$output_file" "$exit_code"

  rm -f "$output_file"
  return "$exit_code"
}

run_step_with_classification() {
  local title="$1"
  shift

  if run_and_capture "$title" "$@"; then
    return 0
  fi

  if looks_like_human_in_loop_blocker "$LAST_OUTPUT_TEXT"; then
    record_blocked "$title"
  else
    record_failure "$title"
  fi

  return 1
}

if ! run_step_with_classification "Versions" \
  /bin/bash -lc "uv --version && soffice --version && '$VENV_PYTHON' --version && pdfinfo -v && pdftoppm -v"; then
  :
fi

if ! run_step_with_classification "Lint" \
  /bin/bash -lc "cd '$PROJECT_DIR' && pnpm lint"; then
  :
fi

if ! run_step_with_classification "Typecheck" \
  /bin/bash -lc "cd '$PROJECT_DIR' && pnpm typecheck"; then
  :
fi

if ! run_step_with_classification "Test" \
  /bin/bash -lc "cd '$PROJECT_DIR' && pnpm test"; then
  :
fi

if ! run_step_with_classification "Build Deck" \
  /bin/bash -lc "cd '$PROJECT_DIR' && pnpm build"; then
  :
fi

if run_step_with_classification "Render Slides" \
  "$VENV_PYTHON" "$SKILL_SCRIPTS_DIR/render_slides.py" \
  "$PPTX_PATH" \
  --output_dir "$RENDERED_DIR"; then
  run_step_with_classification "Overflow Check" \
    "$VENV_PYTHON" "$SKILL_SCRIPTS_DIR/slides_test.py" \
    "$PPTX_PATH"

  run_step_with_classification "Build Montage" \
    "$VENV_PYTHON" "$SKILL_SCRIPTS_DIR/create_montage.py" \
    --input_dir "$RENDERED_DIR" \
    --output_file "$MONTAGE_PATH"
else
  if looks_like_human_in_loop_blocker "$LAST_OUTPUT_TEXT"; then
    append_skipped_section \
      "Overflow Check" \
      "Skipped because Render Slides is human-in-the-loop in this sandbox. Re-run \`pnpm validate\` from a local terminal to complete the LibreOffice-dependent checks."
    record_skipped "Overflow Check"

    append_skipped_section \
      "Build Montage" \
      "Skipped because Render Slides did not produce slide images in this sandbox. Re-run \`pnpm validate\` from a local terminal to generate the montage."
    record_skipped "Build Montage"
  else
    append_skipped_section \
      "Overflow Check" \
      "Skipped because Render Slides failed, so overflow inspection had no rendered input to inspect."
    record_skipped "Overflow Check"

    append_skipped_section \
      "Build Montage" \
      "Skipped because Render Slides failed, so no rendered slide images were available."
    record_skipped "Build Montage"
  fi
fi

if ! run_step_with_classification "Detect Font" \
  /bin/bash -lc "'$VENV_PYTHON' '$SKILL_SCRIPTS_DIR/detect_font.py' '$PPTX_PATH' --json | tee '$FONT_JSON_PATH'"; then
  :
fi

{
  echo "## Artifacts"
  echo
  echo "- PPTX: $PPTX_PATH"
  echo "- Report: $REPORT_PATH"
  echo "- Font JSON: $FONT_JSON_PATH"
  echo "- Montage: $MONTAGE_PATH"
  echo "- Rendered slides: $RENDERED_DIR"
  echo
} >> "$REPORT_PATH"

if [[ "$FAILED_STEPS" -ne 0 || "$BLOCKED_STEPS" -ne 0 || "$SKIPPED_STEPS" -ne 0 ]]; then
  {
    echo "## Summary"
    echo
    if [[ "$FAILED_STEPS" -ne 0 ]]; then
      echo "- Result: FAILED"
    elif [[ "$BLOCKED_STEPS" -ne 0 ]]; then
      echo "- Result: INCOMPLETE (human-in-the-loop required)"
    else
      echo "- Result: PASSED WITH SKIPS"
    fi
    if [[ "$FAILED_STEPS" -ne 0 ]]; then
      echo "- Failed sections: $FAILED_STEPS"
      for title in "${FAILED_TITLES[@]}"; do
        echo "- ${title}"
      done
    fi
    if [[ "$BLOCKED_STEPS" -ne 0 ]]; then
      echo "- Human-in-the-loop sections: $BLOCKED_STEPS"
      for title in "${BLOCKED_TITLES[@]}"; do
        echo "- ${title}"
      done
      echo "- Next action: Re-run \`pnpm validate\` from a local terminal to complete LibreOffice-dependent validation."
    fi
    if [[ "$SKIPPED_STEPS" -ne 0 ]]; then
      echo "- Skipped sections: $SKIPPED_STEPS"
      for title in "${SKIPPED_TITLES[@]}"; do
        echo "- ${title}"
      done
    fi
    echo
  } >> "$REPORT_PATH"
fi

if [[ "$FAILED_STEPS" -ne 0 ]]; then
  echo "Validation completed with failures." >&2
  echo "Markdown report: $REPORT_PATH" >&2
  exit 1
fi

if [[ "$BLOCKED_STEPS" -ne 0 ]]; then
  echo "Validation incomplete. Human-in-the-loop steps remain." >&2
  echo "Markdown report: $REPORT_PATH" >&2
  exit 1
fi

echo "Validation complete."
echo "Markdown report: $REPORT_PATH"
