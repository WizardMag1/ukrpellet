#!/usr/bin/env node
/**
 * Builds the Russian copies of the sales pages: ru/<page>.html, served at /ru/<page>.
 *
 * Language order is fixed by the owner: Ukrainian is the default at "/" and the x-default,
 * English is the in-page toggle, Russian is third and lives only under /ru/ (never opened by default).
 *
 * Source of truth is the Ukrainian page; every Ukrainian string is looked up in
 * data/ru/translations.json ({ "український текст": "русский текст" }). A string with no
 * translation stays Ukrainian and is listed as a warning, so add it to the JSON and re-run.
 *
 * Runs at the end of scripts/sync-layout.cjs; can also be run on its own: node scripts/build-ru.cjs
 */
const fs = require('fs');
const path = require('path');
const { ROOT, SITE, PAGES, mapHtml } = require('./ru-lib.cjs');

const DICT_FILE = path.join(ROOT, 'data', 'ru', 'translations.json');
const OUT_DIR = path.join(ROOT, 'ru');
const dict = JSON.parse(fs.readFileSync(DICT_FILE, 'utf8'));

const ruSlugs = new Set(PAGES.map((p) => p.slug));
const ukUrl = (slug) => (slug ? `${SITE}/${slug}` : `${SITE}/`);
const ruPath = (slug) => (slug ? `/ru/${slug}` : '/ru');

// "/pelety-dnipro#x" -> "/ru/pelety-dnipro#x" when that page has a Russian copy; others untouched.
function localizeHref(href) {
  const m = href.match(/^\/([a-z0-9-]*)([?#].*)?$/);
  if (!m || !ruSlugs.has(m[1])) return href;
  return ruPath(m[1]) + (m[2] || '');
}

const missing = new Map();
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const page of PAGES) {
  const uk = fs.readFileSync(path.join(ROOT, page.file), 'utf8');

  let html = mapHtml(uk, (text) => {
    if (dict[text] !== undefined) return dict[text];
    if (!missing.has(text)) missing.set(text, page.file);
    return undefined;
  });

  html = html.replace('<html lang="uk">', '<html lang="ru">');
  html = html.replace(/<meta property="og:locale" content="uk_UA">/, '<meta property="og:locale" content="ru_UA">\n  <meta property="og:locale:alternate" content="uk_UA">');

  // Canonical and og:url point at the Russian URL; alternates stay identical on both versions.
  const ruUrl = SITE + ruPath(page.slug);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${ruUrl}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${ruUrl}">`);
  html = html.replace(/<link rel="alternate" hreflang="ru" href="[^"]*">/, `<link rel="alternate" hreflang="ru" href="${ruUrl}">`);

  // JSON-LD page URLs (not #fragment entity ids, which name the same company on both versions).
  html = html.replace(/("(?:url|item)":\s*")https:\/\/ukrecopelleta\.org\/([a-z0-9-]*)"/g, (m, key, slug) =>
    ruSlugs.has(slug) ? `${key}${SITE}${ruPath(slug)}"` : m);

  // Internal links stay in Russian where a Russian page exists.
  html = html.replace(/href="(\/[^"]*)"/g, (m, href) => `href="${localizeHref(href)}"`);

  // Switcher: UA and EN go back to the Ukrainian page (i18n.js stores the choice), RU is current.
  const ukPath = page.slug ? `/${page.slug}` : '/';
  html = html.replace(/<div class="lang-switcher"[\s\S]*?<\/div>/, `<div class="lang-switcher" role="group" aria-label="Язык / Мова / Language">
          <a class="lang-btn" data-lang="uk" href="${ukPath}" hreflang="uk" lang="uk">UA</a>
          <a class="lang-btn" data-lang="en" href="${ukPath}" hreflang="uk">EN</a>
          <a class="lang-btn active" data-lang="ru" href="${ruPath(page.slug)}" aria-current="page">RU</a>
        </div>`);

  html = html.replace(/\r\n/g, '\n');
  const out = path.join(OUT_DIR, page.file);
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== html) fs.writeFileSync(out, html, 'utf8');
  console.log(`✓ ru/${page.file}`);
}

if (missing.size) {
  console.warn(`\n⚠ ${missing.size} Ukrainian string(s) have no Russian translation in data/ru/translations.json (left in Ukrainian):`);
  for (const [text, file] of missing) console.warn(`  [${file}] ${text.slice(0, 100)}`);
}
