#!/usr/bin/env bash
# SEO toolset for Claude Code on YOUR machine (user scope, all projects).
# In this repo, .claude/settings.json already offers Claude SEO and .mcp.json already has
# Chrome DevTools MCP; this script is for using them in other projects too.
# Usage: bash scripts/setup-seo-tools.sh
set -euo pipefail
command -v claude >/dev/null || { echo "Install Claude Code first." >&2; exit 1; }

echo "==> Claude SEO (AgriciDaniel/claude-seo, MIT)"
claude plugin marketplace add AgriciDaniel/claude-seo
claude plugin install claude-seo@agricidaniel-claude-seo

echo "==> Chrome DevTools MCP (Google; performance traces / Core Web Vitals)"
claude mcp add --scope user chrome-devtools -- npx chrome-devtools-mcp@latest

cat <<'MSG'

Done. Restart Claude Code, then run:  /seo setup   (creates Claude SEO's Python runtime)

Not automated here, because they need your own accounts:
  - Google Search Console / GA4 MCP: needs a Google OAuth client or service account with access
    to the ukrecopelleta.org property.
  - DataForSEO or Ahrefs MCP: paid API keys.
MSG
