#!/usr/bin/env bash

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

json_write_string_array_items() {
  local indent="$1"
  shift
  local items=("$@")
  local last_index

  if [[ "${#items[@]}" -eq 0 ]]; then
    return 0
  fi

  last_index=$((${#items[@]} - 1))

  for i in "${!items[@]}"; do
    local suffix=","
    if [[ "$i" -eq "$last_index" ]]; then
      suffix=""
    fi
    printf '%s"%s"%s\n' "$indent" "$(json_escape "${items[$i]}")" "$suffix"
  done
}

slugify_project_name() {
  local name="$1"
  local slug
  slug="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"

  if [[ -z "$slug" ]]; then
    echo "Project name must produce a non-empty slug." >&2
    return 1
  fi

  printf '%s' "$slug"
}

root_metadata_path() {
  local deck_root="$1"
  printf '%s/.ai-native-slides/root.json' "$deck_root"
}

project_metadata_path() {
  local project_dir="$1"
  printf '%s/.ai-native-slides/project.json' "$project_dir"
}

is_project_root() {
  local path="$1"
  [[ -f "$(root_metadata_path "$path")" ]] || [[ -d "$path/projects" && ! -f "$(project_metadata_path "$path")" ]]
}

is_project_dir() {
  local path="$1"
  [[ -f "$(project_metadata_path "$path")" ]]
}

is_legacy_deck_workspace() {
  local path="$1"
  [[ ! -d "$path/projects" && ! -f "$(root_metadata_path "$path")" && ( -f "$path/src/main.ts" || -x "$path/validate-local.sh" ) ]]
}

find_deck_root_for_project() {
  local start_dir="$1"
  local current_dir
  current_dir="$(cd "$start_dir" && pwd)"

  while [[ "$current_dir" != "/" ]]; do
    if [[ -f "$(root_metadata_path "$current_dir")" ]]; then
      printf '%s' "$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done

  return 1
}

infer_deck_root_from_project_dir() {
  local project_dir="$1"
  local abs_project_dir
  local projects_dir
  abs_project_dir="$(cd "$project_dir" && pwd)"
  projects_dir="$(dirname "$abs_project_dir")"

  if [[ "$(basename "$projects_dir")" == "projects" ]]; then
    printf '%s' "$(dirname "$projects_dir")"
    return 0
  fi

  return 1
}

write_root_metadata() {
  local deck_root="$1"
  local metadata_path
  metadata_path="$(root_metadata_path "$deck_root")"

  mkdir -p "$(dirname "$metadata_path")"

  cat > "$metadata_path" <<EOF
{
  "layout_version": 2,
  "deck_root": "$(json_escape "$deck_root")",
  "managed_by": "ai-native-slides",
  "created_at": "$(date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

write_project_metadata() {
  local deck_root="$1"
  local project_dir="$2"
  local project_name="$3"
  local project_slug="$4"
  local metadata_path
  metadata_path="$(project_metadata_path "$project_dir")"
  local template_managed_files=(
    ".gitignore"
    "package.json"
    "tsconfig.json"
    "vitest.config.ts"
    "run-project.sh"
    "validate-local.sh"
    "src/main.ts"
  )
  local starter_template_files=(
    "src/buildDeck.ts"
    "src/presentationModel.ts"
    "tests/buildDeck.test.ts"
  )
  local project_content_dirs=(
    "assets"
    "src"
    "tests"
    "output"
    "tmp"
  )
  local ignored_generated_dirs=(
    "node_modules"
    "rendered"
  )
  local legacy_cleanup_targets=(
    "rendered"
    "output/rendered"
    "node_modules/.vite"
    "node_modules/.vite-temp"
  )

  mkdir -p "$(dirname "$metadata_path")"

  {
    echo "{"
    echo "  \"layout_version\": 2,"
    echo "  \"project_name\": \"$(json_escape "$project_name")\","
    echo "  \"project_slug\": \"$(json_escape "$project_slug")\","
    echo "  \"project_root\": \"$(json_escape "$deck_root")\","
    echo "  \"project_dir\": \"$(json_escape "$project_dir")\","
    echo "  \"managed_by\": \"ai-native-slides\","
    echo "  \"template_managed_files\": ["
    json_write_string_array_items "    " "${template_managed_files[@]}"
    echo "  ],"
    echo "  \"starter_template_files\": ["
    json_write_string_array_items "    " "${starter_template_files[@]}"
    echo "  ],"
    echo "  \"project_content_dirs\": ["
    json_write_string_array_items "    " "${project_content_dirs[@]}"
    echo "  ],"
    echo "  \"ignored_generated_dirs\": ["
    json_write_string_array_items "    " "${ignored_generated_dirs[@]}"
    echo "  ],"
    echo "  \"legacy_cleanup_targets\": ["
    json_write_string_array_items "    " "${legacy_cleanup_targets[@]}"
    echo "  ],"
    echo "  \"created_at\": \"$(date '+%Y-%m-%dT%H:%M:%S%z')\""
    echo "}"
  } > "$metadata_path"
}

assert_not_project_root() {
  local path="$1"
  local script_dir="$2"

  if is_project_root "$path"; then
    echo "Path looks like a deck project root, not a single deck project: $path" >&2
    echo "Initialize a project with: bash \"$script_dir/init_deck_project.sh\" \"$path\" <project-name>" >&2
    echo "Or pass a concrete project directory under \"$path/projects/<slug>\"." >&2
    return 1
  fi

  return 0
}

assert_not_project_dir() {
  local path="$1"
  local script_dir="$2"

  if is_project_dir "$path"; then
    echo "Path looks like a project directory, not a deck root: $path" >&2
    echo "Pass the parent root above \"$path\", or use project-level scripts such as:" >&2
    echo "bash \"$script_dir/ensure_deck_workspace.sh\" \"$path\"" >&2
    return 1
  fi

  return 0
}
