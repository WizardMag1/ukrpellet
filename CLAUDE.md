# UkrEcoPelleta — working notes for Claude (and contributors)

Static site for ТОВ «УКРЕКОПЕЛЕТА» (wood pellets, factory in Nikopol, sold across Ukraine, UA/RU/EN).
Goal: rank first in Google for "купити пелети / купить пеллеты" nationwide. Design rules are in `DESIGN.md`.

## How it is served
Browser → Cloudflare Worker `ukrecopelleta-edge` (`cloudflare/`) → Vercel project (`api/`, static pages).
The Worker redirects http/www to `https://ukrecopelleta.org`, serves `/api/pricing` from KV, stamps the live price into
HTML, and hosts the Telegram price bot (`docs/BOT_DEPLOY.md`). Cloudflare Workers Builds deploys it on merge to master.

## Before you push
`npm test` must pass, then `npm run sync` must leave `git status` clean (CI runs both). That is the whole gate.

## Generated files: change the source, not the output
- `scripts/sync-layout.cjs` stamps header, footer, inline CSS, phone/place fields and asset versions into every page,
  runs `build-cities.cjs` first and `build-ru.cjs` last. Bump `ASSET_VERSION` in it when a CSS/JS file changes.
- `pelety-<city>.html` (19 oblast centres) come from `scripts/build-cities.cjs` + `scripts/data/cities.cjs`. Each page
  needs data of its own (distance tier, oblast town table); never add a city with copy-pasted text.
- `/ru/*` is built from the Ukrainian pages through `data/ru/translations.json`. New Ukrainian text needs a dictionary
  entry or it stays Ukrainian on the RU page.
- English is a client-side toggle: `assets/js/i18n.js` (`data-i18n` keys, unique per language block).
- The sitemap city block and the city list in `pelety-optom.html` are generated.
- Generated output must be idempotent and must not depend on `data/fuel.json` (it changes daily), or CI turns red.

## Prices
`data/pricing.json` is the single source (changed by the bot). The Action `pricing-sync.yml` then runs
`scripts/sync-pricing.cjs` to rewrite prices in pages, RU copies, JSON-LD, `llms*.txt`. Use
`<span data-dynamic-price="pine">` for a price inside translated text, never a literal number in i18n strings.

## Secrets
Nothing secret in the repo, ever (`.env.example` holds placeholders only). Vercel env: lead form (`.env.example`).
Cloudflare Worker secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `GITHUB_TOKEN`.

## Things that were broken once
- `robots.txt` must not disallow `?` URLs (assets load as `?v=`) or `/api/pricing` (pages fetch it while rendering).
- Canonicals point at the clean URL; calculator links use `?city=<slug>&obl=<Oblast>` and are not indexable pages.
- Doorway pages: do not generate city pages without unique data.

## Git
Squash-merged PRs. After a PR is merged, restart the working branch from `origin/master`.
