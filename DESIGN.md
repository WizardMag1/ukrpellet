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
  Menu: Пелети · Калькулятор · Доставка · Про завод · Контакти, phone, UA/EN, «Запит ціни».
- Section headings are left-aligned and have **no eyebrow label** above them.
- Lists of facts are lists with rules between items, not grids of identical rounded cards with icons.
- Spec values go in the spec sheet (`.specs-grid`), not in floating badges over photos.
- Don't repeat the same figures twice on one screen.

## Things that make a page read as AI-generated — do not add

- Emoji as icons (🔥 🧮 📍 🚚 💡 ✔ …) in buttons, nav, lists or footer
- `A • B • C` meta strings, `→` appended to buttons or links
- Pill badges above the headline ("Екологічне біопаливо європейського стандарту")
- Coloured left-border callout boxes
- Two-colour wordmarks (the brand is set in one colour: **UkrEcoPelleta**)
- Pulsing/animated attention borders, fade-up-on-scroll on every section

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

Claude Code asks you to approve the `.mcp.json` servers the first time. To install the same tools
for all your projects: `bash scripts/setup-design-tools.sh`.
