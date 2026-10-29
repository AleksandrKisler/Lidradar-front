#!/usr/bin/env bash
set -euo pipefail

frontend_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$frontend_root"
mode="${1:-doctor}"
case "$mode" in
  doctor|login|start|resume) ;;
  *) printf 'Usage: bash scripts/codex-frontend.sh [doctor|login|start|resume]\n' >&2; exit 2 ;;
esac
if [[ $# -gt 1 ]]; then
  printf 'Expected one mode, no extra arguments.\n' >&2
  exit 2
fi

codex_bin="${LIDRADAR_CODEX_BIN:-}"
if [[ -z "$codex_bin" ]]; then
  codex_bin="$(command -v codex || true)"
fi
if [[ -z "$codex_bin" ]]; then
  for candidate in \
    /Applications/Codex.app/Contents/Resources/codex \
    /Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex; do
    if [[ -x "$candidate" ]]; then codex_bin="$candidate"; break; fi
  done
fi
if [[ -z "$codex_bin" || ! -x "$codex_bin" ]]; then
  printf 'Codex CLI not found. Set LIDRADAR_CODEX_BIN to its executable path.\n' >&2
  exit 1
fi
if [[ "$mode" == login ]]; then exec "$codex_bin" login; fi

node_version="$(tr -d '[:space:]' < .nvmrc)"
node_bin="$HOME/.nvm/versions/node/v${node_version}/bin"
if [[ -x "$node_bin/node" ]]; then export PATH="$node_bin:$PATH"; fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Node %s is required (see .nvmrc).\n' "$node_version" >&2
  exit 1
fi
actual_node="$(node --version)"
if [[ "$actual_node" != "v$node_version" ]]; then
  printf 'Expected Node %s; found %s. Activate .nvmrc first.\n' "$node_version" "$actual_node" >&2
  exit 1
fi
for required in AGENTS.md .codex/config.toml docs/frontend-v2/CODEX-START.md; do
  if [[ ! -f "$required" ]]; then printf 'Missing project file: %s\n' "$required" >&2; exit 1; fi
done

if [[ "$mode" == doctor ]]; then
  printf 'Frontend: %s\nNode: %s\nCodex: ' "$frontend_root" "$actual_node"
  "$codex_bin" --version
  # Validates settings without starting an agent, logging in or printing credentials.
  "$codex_bin" app-server --strict-config --print-startup-config >/dev/null
  printf 'Codex startup config: valid\n'
  node --input-type=module - <<'JS'
import fs from 'node:fs'
import path from 'node:path'
const config = fs.readFileSync('.codex/config.toml', 'utf8')
console.log(config.split('\n').filter(line => /^(model|model_reasoning_effort|max_concurrent_threads_per_session) =/.test(line)).join('\n'))
for (const file of fs.readdirSync('.codex/agents').filter(file => file.endsWith('.toml')).sort()) {
  const source = fs.readFileSync(path.join('.codex/agents', file), 'utf8')
  const field = key => source.match(new RegExp(`^${key} = "([^"]+)"`, 'm'))?.[1] ?? 'MISSING'
  console.log(`Agent: ${field('name')} | ${field('model')} | ${field('model_reasoning_effort')}`)
}
console.log('Runtime model/role discovery and Figma access: verify in the interactive session.')
console.log('Backend docs and design are read-only sources; see docs/frontend-v2/SOURCES.md.')
JS
  exit 0
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  printf 'Start/resume requires an interactive terminal for login and workspace trust.\n' >&2
  exit 1
fi
# External sources stay read-only: --add-dir would grant them write access.
args=(--cd "$frontend_root" --sandbox workspace-write --ask-for-approval on-request)
if [[ "$mode" == resume ]]; then
  exec "$codex_bin" "${args[@]}" resume
fi
prompt="$(cat docs/frontend-v2/CODEX-START.md)"
exec "$codex_bin" "${args[@]}" -- "$prompt"
