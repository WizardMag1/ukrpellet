#!/usr/bin/env bash
# Installs the anti-"AI look" design toolset for Claude Code on YOUR machine (user scope),
# so it works in every project, not just this repo.
#
# This repo already ships the same tools at project scope, no install needed here:
#   .claude/skills/impeccable, hallmark, frontend-design   (skills)
#   .mcp.json: playwright, shadcn, motion, motion-plus      (MCP servers; approve on first use)
#
# Usage: bash scripts/setup-design-tools.sh
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1 — install it first." >&2; exit 1; }; }
need node
need npx
need claude

step() { printf '\n==> %s\n' "$1"; }

step "1/6 Impeccable (design rules + 61-rule AI-pattern detector)"
claude plugin marketplace add pbakaus/impeccable
claude plugin install impeccable@impeccable

step "2/6 Hallmark (anti-AI-look design skill)"
npx --yes skills add nutlope/hallmark

step "3/6 Anthropic Frontend Design plugin"
# The official marketplace is only auto-registered after the first interactive session.
claude plugin marketplace add anthropics/claude-plugins-official || true
claude plugin install frontend-design@claude-plugins-official

step "4/6 shadcn MCP"
claude mcp add --scope user shadcn -- npx shadcn@latest mcp

step "5/6 Playwright MCP (lets Claude open the page in a browser and check its own work)"
claude mcp add --scope user playwright -- npx @playwright/mcp@latest

step "6/6 Motion AI Kit (interactive; docs search is free, audits need paid Motion+)"
npx --yes motion-ai

cat <<'EOF'

Done. Restart Claude Code, then in a project:
  /impeccable init        write the product/design context first
  /impeccable audit       check a page against the rules
  npx impeccable detect http://localhost:3000/   run the detector without Claude
EOF
