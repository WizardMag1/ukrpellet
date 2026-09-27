# UkrEcoPelleta — design rules

Read this before changing any page or `assets/css/styles.css`. Every page follows it.

## Who the site is for

Procurement people at boiler houses, farms, greenhouses and businesses in Dnipropetrovsk oblast
buying pellets in lots of 15 t and up. The site's one job: get them to call or request a price.
Write and design like a plant manager talks: facts, numbers, the phone number. No sales filler.

## Colour — five tokens, nothing else

| Token | Hex | Use |
|---|---|---|
| `--forest` | `#1f4a32` | Brand. Buttons, links, the logo tile |
| `--forest-deep` | `#14301f` | Dark surfaces: contact block, calculator result, footer |
| `--pellet` | `#c9975a` | The colour of a pine pellet. Accents on dark surfaces only |
| `--ink` | `#1b201c` | Text. `--ink-muted` `#59625b` for secondary text |
| `--paper` / `--paper-alt` | `#ffffff` / `#f3f4f1` | Backgrounds |

- No gradients, glows, glass/blur panels, or neon greens (`#22c55e`, `#86efac`, `#4ade80`).
- Text on white must reach WCAG AA (4.5:1). `--pellet` fails that on white; use `--pellet-ink` `#85572a`.

## Type

- **Fixel** (MacPaw, Kyiv; SIL OFL; self-hosted in `assets/fonts/fixel/`). Full Cyrillic.
  Fixel Display Bold for headings, Fixel Text 400/500/600 for everything else.
- Do not add Google Fonts. Inter / Plus Jakarta Sans were removed: Plus Jakarta has no Cyrillic,
  so every Ukrainian heading was silently rendering in a system fallback font.
- Sentence case everywhere. **No all-caps labels.**
- Paragraphs ≤ ~65 characters per line (`max-width: 62ch` on `.lead`).

## Spacing and shape

- Spacing on a 4px grid (multiples of 0.25rem).
- Radii: 6px buttons/inputs, 8px images and panels. No pill shapes anywhere (the language switch is
  a squared segmented control).
- No drop shadows (the modal is the one exception). No hover lift (`translateY`) or image zoom.

## Structure

- **One header on every page.** It is generated: edit `scripts/sync-layout.cjs`, then run
  `node scripts/sync-layout.cjs`. Never hand-edit a page's `<header>`.
  Menu, in buyer priority: Ціни (calculator) · Продукція (wood, quality) · Доставка · Про завод · Контакти,
  then phone, UA/EN, «Запит ціни».
- Every sales-page hero carries the **buyer facts** block (price, wood, quality, lot size), also generated
  by `sync-layout.cjs`. Its price is read from `PRICING`, so it can't drift from the calculator.
- Section headings are left-aligned and have **no eyebrow label** above them.
- Lists of facts are lists with rules between items, not grids of identical rounded cards with icons.
- Spec values go in the spec sheet (`.specs-grid`), not in floating badges over photos.
- Don't repeat the same figures twice on one screen.

## Motion

Motion answers what the visitor does. It never decorates.

| Where | What | Timing |
|---|---|---|
| Calculator (the one focal moment) | Big-bags drop into truck rows as tonnage changes; mark at 15 t; numbers roll | bags `--spring-load`, numbers 320 ms |
| Buttons | Press in slightly | `--spring-press` |
| Quote form, mobile menu | Rise into place; close faster than they open | `--spring-firm` in, 150 ms out |
| FAQ answer | Text eases down 6px as it opens | 280 ms |
| Hero photo | Settles into its frame once on load (visible from frame 1, no fade) | 700 ms |

- Springs come from Motion's `spring()` (Motion AI Kit) and are pasted into CSS as `linear()` tokens,
  so no animation library ships to visitors. No overshoot: this is an industrial B2B site.
- Animate only `transform` and `opacity`. Never `height`/`width`/`top` (Impeccable flags it).
- No fade-in-on-scroll for sections, no hover lifts, no count-up stats, no looping animation.
- `prefers-reduced-motion`: remove movement, keep colour/opacity state changes and instant values.
- Check new motion at 1/10 speed (Chrome DevTools → Animations → 10%) before shipping.

## Things that make a page read as AI-generated — do not add

- Emoji as icons (🔥 🧮 📍 🚚 💡 ✔ …) in buttons, nav, lists or footer
- `A • B • C` meta strings, `→` appended to buttons or links
- Pill badges above the headline ("Екологічне біопаливо європейського стандарту")
- Coloured left-border callout boxes
- Two-colour wordmarks (the brand is set in one colour: **UkrEcoPelleta**)
- Pulsing/animated attention borders, fade-up-on-scroll on every section

## Prices

Calculator prices live in one place: `assets/js/analytics-config.js` → `PRICING` (UAH per tonne, ex-warehouse,
separately for pine and acacia + elm). Current price: **14 500 грн/т for both** (set by the owner, Sep 2026).
When it changes, also update the JSON-LD `lowPrice`/`highPrice`/`priceRange` and the FAQ price answers on the
pages so all three agree.

## Delivery pricing

The calculator adds delivery = trucks × distance × (fuel for the loaded run + the empty return) + driver pay.
Truck inputs live in `assets/js/analytics-config.js` → `DELIVERY` (consumption loaded / empty, driver rate per
km, big bags per truck, 15 km minimum for addresses next to the warehouse).

**Where the buyer is.** The buyer types a town or village and picks it from the list; nobody types kilometres.
The list is `assets/data/places.json` (≈26 000 settlements, ~300 KB gzipped, fetched only when the search box is
used). It is built by `scripts/build-places.cjs`:

- settlements and coordinates: `ua-location` (npm; Ukraine humanitarian reference data), town/village type from
  the KATOTTG register (`ua-geo-set`); the 2024 renames Самар and Шахтарське are applied, the old names stay searchable;
- occupied communities are left out: `scripts/data/occupied-hromadas.json` (≥50% under Russian control, 31.01.2024).
  Update that file when the situation changes, then rebuild;
- road km from the warehouse (47.58261, 34.33747) come from OSRM on the OpenStreetMap map of Ukraine, run locally
  once per rebuild (the public OSRM server is non-commercial only). In the car profile, `process_node` starts with
  a barrier for the occupied cells, so no route goes through occupied territory:
  ```lua
  local occupied_cells = require('occupied_cells')   -- written by: build-places.cjs mask occupied_cells.lua
  -- first lines of process_node(profile, node, result, relations):
  local loc = node:location()
  if occupied_cells[math.floor(loc:lat() / 0.02 + 1e-9) .. ':' .. math.floor(loc:lon() / 0.02 + 1e-9)] then
    result.barrier = true
    return
  end
  ```
  Distances follow OSRM's fastest route, so long trips can come out longer than the shortest road (Kyiv: 600 km
  vs 519 km by the shorter road via Kropyvnytskyi). Within Dnipropetrovsk oblast and its neighbours they agree with
  published road distances to within about 10%.
- `DELIVERY.distances_km` keeps the same numbers for the `?city=` links on the city pages, so the calculator shows a
  price before the list has loaded. Keep them in step when you rebuild.

**Diesel price.** `data/fuel.json` is updated daily by `.github/workflows/fuel-price.yml`
(`scripts/update-fuel.cjs`, average ДП price at Ukrainian filling stations from index.minfin.com.ua):

- price goes **up**: the calculator uses it the same day;
- price goes **down**: nothing changes for 7 days. Only if the market stays below our price for a whole week do we
  lower it, and then to the highest price seen that week. A short dip never produces a quote that is too low.

The rule is tested in `scripts/update-fuel.test.cjs` (runs in CI). `DELIVERY.diesel_uah_per_l` is only the
fallback for when `data/fuel.json` can't be read. To change the rule, edit `DECREASE_DELAY_DAYS` in the script.

## Before you ship a change

1. Bump `ASSET_VERSION` in `scripts/sync-layout.cjs` and run it. `/assets/*` is cached as
   `immutable` for a year (`vercel.json`), so without a new `?v=` returning visitors keep the old CSS/JS.
2. Check 1440, 1280, 1024, 768, 390 and 360 px widths in **both** UA and EN (EN labels are longer).
   The header must never wrap or overflow.
3. Optional independent audit: `npx impeccable detect http://localhost:3000/` — sales pages should
   report 0 findings.
4. `npm run check` (SEO checks).

## Design tools installed in this repo

Load automatically in Claude Code sessions opened in this repo (local and cloud):

| Tool | Where | Use |
|---|---|---|
| Impeccable (pbakaus, Apache-2.0, `9d715cc`) | `.claude/skills/impeccable/` | `/impeccable audit`, `polish`, `critique`, `quieter`, `typeset`, `layout` |
| Hallmark (nutlope, MIT, `13ac0ec`) | `.claude/skills/hallmark/` | `hallmark study <url>` to learn from a reference site. Don't run `hallmark redesign` on these pages: it replaces this design system with one of its own themes |
| Frontend Design (Anthropic, Apache-2.0) | `.claude/skills/frontend-design/` | Base rules the current design follows |
| Playwright MCP | `.mcp.json` | Claude opens the page in a browser to check its own work |
| shadcn MCP | `.mcp.json` | React component registry. This site is plain HTML, so only useful if it moves to React |
| Motion MCP (+ Motion+) | `.mcp.json` | Animation docs; audits need a paid Motion+ sign-in |

| Claude SEO (AgriciDaniel, MIT) | `.claude/settings.json` (plugin) | `/seo audit`, `/seo local`, `/seo schema`, `/seo geo`. Run `/seo setup` once. Loads in local Claude Code only (plugins don't load in cloud sessions) |
| Chrome DevTools MCP (Google) | `.mcp.json` | Performance traces for Core Web Vitals |

Claude Code asks you to approve the `.mcp.json` servers the first time. To install the same tools
for all your projects: `bash scripts/setup-design-tools.sh` and `bash scripts/setup-seo-tools.sh`.
