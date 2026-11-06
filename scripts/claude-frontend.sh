#!/usr/bin/env bash
set -euo pipefail

frontend_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$frontend_root"
backend_docs="${LIDRADAR_BACKEND_DOCS:-$(dirname -- "$frontend_root")/Lidradar/docs}"
design_root="${LIDRADAR_DESIGN_ROOT:-$HOME/Documents/LidRadar_MVP_v1.1_package/design}"
mode="${1:-start}"
case "$mode" in
  doctor|login|start|resume) ;;
  *) printf 'Usage: bash scripts/claude-frontend.sh [doctor|login|start|resume]\n' >&2; exit 2 ;;
esac

node_version="$(tr -d '[:space:]' < .nvmrc)"
node_bin="$HOME/.nvm/versions/node/v${node_version}/bin"
if [[ -x "$node_bin/node" ]]; then
  export PATH="$node_bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Node %s is required (see .nvmrc).\n' "$node_version" >&2
  exit 1
fi
actual_node="$(node --version)"
if [[ "$actual_node" != "v$node_version" ]]; then
  printf 'Expected Node %s; found %s. Activate the .nvmrc version first.\n' "$node_version" "$actual_node" >&2
  exit 1
fi

claude_bin="${LIDRADAR_CLAUDE_BIN:-}"
if [[ -z "$claude_bin" ]]; then
  claude_bin="$(command -v claude || true)"
fi
if [[ -z "$claude_bin" && -x "$HOME/.local/bin/claude" ]]; then
  claude_bin="$HOME/.local/bin/claude"
fi
if [[ -z "$claude_bin" ]]; then
  # Desktop updates its version directory; select the newest installed executable.
  claude_bin="$(node --input-type=module - <<'JS'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const base = path.join(os.homedir(), 'Library/Application Support/Claude/claude-code')
const found = []
if (fs.existsSync(base)) {
  for (const version of fs.readdirSync(base)) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue
    const dir = path.join(base, version)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const hash of fs.readdirSync(dir)) {
      const bin = path.join(dir, hash, 'claude.app/Contents/MacOS/claude')
      try { fs.accessSync(bin, fs.constants.X_OK); found.push({ version, bin }) } catch {}
    }
  }
}
found.sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }))
process.stdout.write(found[0]?.bin || '')
JS
)"
fi
if [[ ! -x "$claude_bin" ]]; then
  printf 'Claude Code not found. Open/update Claude Desktop or install the official CLI.\n' >&2
  exit 1
fi
if [[ "$mode" == login ]]; then
  exec "$claude_bin" auth login
fi
for source_dir in "$backend_docs" "$design_root"; do
  if [[ ! -d "$source_dir" ]]; then
    printf 'Source directory missing: %s\n' "$source_dir" >&2
    exit 1
  fi
done

if [[ "$mode" == doctor ]]; then
  printf 'Frontend: %s\nNode: %s\nClaude: ' "$frontend_root" "$actual_node"
  "$claude_bin" --version
  printf 'Backend docs: %s\nDesign: %s\n' "$backend_docs" "$design_root"
  LIDRADAR_RESOLVED_CLAUDE="$claude_bin" node --input-type=module - <<'JS'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const settings = JSON.parse(fs.readFileSync('.claude/settings.json', 'utf8'))
const mcp = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'))
console.log('Configured model:', settings.model)
console.log('Figma endpoint:', mcp.mcpServers.figma.url)
console.log('Agents:', fs.readdirSync('.claude/agents').filter(x => x.endsWith('.md')).join(', '))
const result = spawnSync(process.env.LIDRADAR_RESOLVED_CLAUDE, ['auth', 'status'], {
  encoding: 'utf8', timeout: 20000,
})
try {
  const auth = JSON.parse(result.stdout)
  console.log('CLI authenticated:', auth.loggedIn === true)
  if (!auth.loggedIn) console.log('Next: bash scripts/claude-frontend.sh login')
} catch {
  console.log('CLI auth status unavailable; check interactively. No credentials printed.')
}
console.log('Figma OAuth and runtime agent loading must be checked in the interactive session.')
JS
  exit 0
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  printf 'Start/resume requires an interactive terminal for login and workspace trust.\n' >&2
  exit 1
fi
args=(--model sonnet --permission-mode auto --add-dir "$backend_docs" --add-dir "$design_root")
if [[ "$mode" == resume ]]; then
  exec "$claude_bin" "${args[@]}" --resume
fi
prompt="$(cat docs/frontend-v2/START.md)"
exec "$claude_bin" "${args[@]}" -- "$prompt"
