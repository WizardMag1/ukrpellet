#!/usr/bin/env node
/**
 * Stamps the one shared site header into every page and keeps asset URLs versioned.
 *
 * Why: the pages are plain static HTML with no build step, and each had drifted into its
 * own header (different menu items, button colors, logos). Edit the header here, then run
 *   node scripts/sync-layout.cjs
 *
 * Asset versioning: vercel.json caches /assets/* as immutable for a year, so a changed
 * CSS/JS/SVG file only reaches returning visitors if its URL changes. Bump ASSET_VERSION
 * whenever you edit anything under /assets and re-run this script.
 */
const fs = require('fs');
const path = require('path');

const ASSET_VERSION = '20260926';
const ROOT = path.join(__dirname, '..');

// pagePath: the clean URL the page is served at (vercel.json cleanUrls).
// interactive: page loads i18n.js and has the #contact-dialog quote modal.
const PAGES = {
  'index.html': { pagePath: '/', interactive: true },
  'pellets.html': { pagePath: '/pellets', interactive: true, current: '/pellets' },
  'pelety-nikopol.html': { pagePath: '/pelety-nikopol', interactive: true },
  'pelety-dnipro.html': { pagePath: '/pelety-dnipro', interactive: true },
  'pelety-kryvyi-rih.html': { pagePath: '/pelety-kryvyi-rih', interactive: true },
  'pelety-kamianske.html': { pagePath: '/pelety-kamianske', interactive: true },
  'pelety-pavlohrad.html': { pagePath: '/pelety-pavlohrad', interactive: true },
  'pelety-optom.html': { pagePath: '/pelety-optom', interactive: true },
  'oferta.html': { pagePath: '/oferta', interactive: false },
  'privacy.html': { pagePath: '/privacy', interactive: false },
};

const NAV = [
  { href: '/pellets', key: 'nav.pellets', label: 'Пелети' },
  { href: '/pellets#calculator', key: 'nav.calculator', label: 'Калькулятор' },
  { href: '/pellets#logistics', key: 'nav.logistics', label: 'Доставка' },
  { href: '/#about-company', key: 'nav.about', label: 'Про завод' },
  { href: '/#contacts', key: 'nav.contacts', label: 'Контакти' },
];

const PHONE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
const MENU_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';

// Same-page links become bare #hashes so they scroll instead of reloading.
function resolveHref(href, page, html) {
  const [target, hash] = href.split('#');
  if (!hash) return href;
  if (target === page.pagePath) return `#${hash}`;
  // "Контакти" should stay on the page when the page has its own contacts block.
  if (hash === 'contacts' && html.includes('id="contacts"')) return '#contacts';
  return href;
}

function buildHeader(page, html) {
  const i18n = (key) => (page.interactive ? ` data-i18n="${key}"` : '');
  const links = NAV.map(({ href, key, label }) => {
    const current = page.current === href ? ' aria-current="page"' : '';
    return `        <a href="${resolveHref(href, page, html)}" class="nav-link"${current}${i18n(key)}>${label}</a>`;
  }).join('\n');

  const cta = page.interactive
    ? `<button type="button" class="btn btn-primary btn-sm header-cta" data-open-modal data-i18n="nav.quote_btn">Запит ціни</button>`
    : `<a href="/pellets#contacts" class="btn btn-primary btn-sm header-cta">Запит ціни</a>`;
  const mobileCta = page.interactive
    ? `<button type="button" class="btn btn-primary" data-open-modal data-i18n="nav.quote_btn">Запит ціни</button>`
    : `<a href="/pellets#contacts" class="btn btn-primary">Запит ціни</a>`;
  const lang = page.interactive
    ? `
        <div class="lang-switcher" role="group" aria-label="Мова / Language">
          <button type="button" class="lang-btn active" data-lang="uk">UA</button>
          <button type="button" class="lang-btn" data-lang="en">EN</button>
        </div>`
    : '';

  return `<header class="site-header">
    <div class="container header-inner">
      <a href="/" class="brand-logo" aria-label="UkrEcoPelleta — головна">
        <img class="brand-mark" src="/assets/images/favicon.svg?v=${ASSET_VERSION}" alt="" width="40" height="40">
        <span class="brand-text">
          <span class="brand-title">UkrEcoPelleta</span>
          <span class="brand-subtitle"${i18n('brand.tagline')}>Пелетний завод у Нікополі</span>
        </span>
      </a>

      <nav class="nav-menu" id="nav-menu" aria-label="Основна навігація">
${links}
        <div class="mobile-nav-cta">
          ${mobileCta}
        </div>
      </nav>

      <div class="header-actions">
        <a href="tel:+380664035396" class="header-phone" aria-label="Зателефонувати +38 066 403 53 96">
          ${PHONE_ICON}
          <span>+38 (066) 403-53-96</span>
        </a>${lang}
        ${cta}
        <button type="button" class="mobile-toggle" id="mobile-menu-toggle" aria-label="Меню" aria-controls="nav-menu" aria-expanded="false">
          ${MENU_ICON}
        </button>
      </div>
    </div>
  </header>`;
}

const FOOTER_MARK = `<img class="brand-mark" src="/assets/images/favicon.svg?v=${ASSET_VERSION}" alt="" width="40" height="40">`;

let failed = false;
for (const [file, page] of Object.entries(PAGES)) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, 'utf8');

  // 1. Header: replace everything from the (optional) top bar through </header>.
  const headerStart = /\n[ \t]*(?:<!--[^>]*-->\s*)?(?:<div class="top-bar">[\s\S]*?)?<header class="site-header">[\s\S]*?<\/header>/;
  if (!headerStart.test(html)) {
    console.error(`✗ ${file}: header not found`);
    failed = true;
    continue;
  }
  html = html.replace(headerStart, `\n  ${buildHeader(page, html)}`);

  // 2. Footer brand block: old decorative icon container -> the real mark.
  html = html.replace(/<div class="brand-icon">\s*(?:<svg[\s\S]*?<\/svg>|<img[^>]*>)\s*<\/div>/g, FOOTER_MARK);

  // 3. Google Fonts are replaced by self-hosted Fixel (Cyrillic support).
  html = html.replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\n/g, '');
  html = html.replace(/[ \t]*<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n/g, '');
  if (!html.includes('FixelDisplay-Bold.woff2')) {
    html = html.replace(
      /([ \t]*)<link rel="stylesheet" href="\/?assets\/css\/styles\.css[^"]*">/,
      `$1<link rel="preload" href="/assets/fonts/fixel/FixelText-Regular.woff2" as="font" type="font/woff2" crossorigin>\n` +
      `$1<link rel="preload" href="/assets/fonts/fixel/FixelDisplay-Bold.woff2" as="font" type="font/woff2" crossorigin>\n` +
      `$1<link rel="stylesheet" href="/assets/css/styles.css">`
    );
  }

  // 4. Every /assets css/js/svg reference gets the current version query.
  html = html.replace(
    /(src|href)="\/?(assets\/(?:css|js)\/[\w.-]+\.(?:css|js)|assets\/images\/favicon\.svg)(?:\?v=[\w.-]*)?"/g,
    `$1="/$2?v=${ASSET_VERSION}"`
  );

  // 5. Legal pages previously loaded no main.js, so the mobile menu could not open.
  if (!page.interactive && !html.includes('/assets/js/main.js')) {
    html = html.replace('</body>', `  <script src="/assets/js/main.js?v=${ASSET_VERSION}"></script>\n</body>`);
  }

  fs.writeFileSync(full, html);
  console.log(`✓ ${file}`);
}
process.exit(failed ? 1 : 0);
