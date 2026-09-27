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

const ASSET_VERSION = '20260927-3';
const ROOT = path.join(__dirname, '..');

// pagePath: the clean URL the page is served at (vercel.json cleanUrls).
// interactive: page loads i18n.js and has the #contact-dialog quote modal.
const PAGES = {
  'index.html': { pagePath: '/', interactive: true },
  'pellets.html': { pagePath: '/pellets', interactive: true, current: '/pellets#specs' },
  'pelety-nikopol.html': { pagePath: '/pelety-nikopol', interactive: true, city: 'nikopol_pickup' },
  'pelety-dnipro.html': { pagePath: '/pelety-dnipro', interactive: true, city: 'dnipro' },
  'pelety-kryvyi-rih.html': { pagePath: '/pelety-kryvyi-rih', interactive: true, city: 'kryvyi_rih' },
  'pelety-kamianske.html': { pagePath: '/pelety-kamianske', interactive: true, city: 'kamianske' },
  'pelety-pavlohrad.html': { pagePath: '/pelety-pavlohrad', interactive: true, city: 'pavlohrad' },
  'pelety-optom.html': { pagePath: '/pelety-optom', interactive: true },
  'oferta.html': { pagePath: '/oferta', interactive: false },
  'privacy.html': { pagePath: '/privacy', interactive: false },
};

// Ordered by what a buyer looks for first: price, then the product and its quality, then delivery.
const NAV = [
  { href: '/pellets#calculator', key: 'nav.prices', label: 'Ціни' },
  { href: '/pellets#specs', key: 'nav.product', label: 'Продукція' },
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

// Price shown in the buyer facts comes from the same setting the calculator uses.
function priceText() {
  const cfg = fs.readFileSync(path.join(ROOT, 'assets/js/analytics-config.js'), 'utf8');
  const pine = Number((cfg.match(/pine_uah_per_t:\s*(\d+)/) || [])[1]);
  const mix = Number((cfg.match(/acacia_elm_uah_per_t:\s*(\d+)/) || [])[1]);
  if (!pine || !mix) throw new Error('PRICING not found in analytics-config.js');
  const fmt = (n) => n.toLocaleString('uk-UA').replace(/\u00a0/g, ' ');
  return pine === mix ? fmt(pine) : `від ${fmt(Math.min(pine, mix))}`;
}

// What a buyer came for, right under every sales-page headline: price, wood, quality, lot size.
function buildFacts(page, html) {
  // City pages open the calculator with their city preselected; on /pellets it's a same-page jump.
  const calc = resolveHref('/pellets' + (page.city ? `?city=${page.city}` : '') + '#calculator', page, html);
  const specs = resolveHref('/pellets#specs', page, html);
  return `<!-- buy-facts: generated by scripts/sync-layout.cjs -->
        <dl class="buy-facts">
          <div>
            <dt data-i18n="facts.price">Ціна</dt>
            <dd><strong>${priceText()}</strong> <span data-i18n="facts.price_unit">грн/т зі складу</span><br><a href="${calc}" data-i18n="facts.price_link">Розрахувати з доставкою</a></dd>
          </div>
          <div>
            <dt data-i18n="facts.wood">Деревина</dt>
            <dd data-i18n="facts.wood_v">Сосна 100% або акація + берест</dd>
          </div>
          <div>
            <dt data-i18n="facts.quality">Якість</dt>
            <dd><span data-i18n="facts.quality_v">Параметри класу A1, паспорт якості на кожну партію</span><br><a href="${specs}" data-i18n="facts.quality_link">Усі характеристики</a></dd>
          </div>
          <div>
            <dt data-i18n="facts.lot">Партія</dt>
            <dd data-i18n="facts.lot_v">Доставка від 15 т, самовивіз від 1 біг-бега</dd>
          </div>
        </dl>
        <!-- /buy-facts -->`;
}

// Quote form: how the buyer receives the pellets and how they'll unload 650 kg bags, so the sales
// team knows before calling whether a forklift, crane truck or smaller vehicle is involved.
// Values stay in Ukrainian (they go to the sales team); the visible labels are translated by i18n.js.
function buildLogistics(page) {
  const pickup = page.city === 'nikopol_pickup';
  const opt = (name, value, key, label, checked, extra = '') =>
    `<label class="form-choice-opt"><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}${extra}> <span data-i18n="${key}">${label}</span></label>`;
  return `<!-- logistics: generated by scripts/sync-layout.cjs -->
        <fieldset class="form-group form-choice">
          <legend class="form-label" data-i18n="form.receive_label">Як отримаєте пелети? *</legend>
          ${opt('receive', 'Доставка', 'form.receive_delivery', 'Доставка нашою вантажівкою', !pickup, ' required')}
          ${opt('receive', 'Самовивіз', 'form.receive_pickup', 'Самовивіз зі складу в Нікополі', pickup)}
        </fieldset>

        <fieldset class="form-group form-choice" data-receive="Самовивіз"${pickup ? '' : ' hidden disabled'}>
          <legend class="form-label" data-i18n="form.vehicle_label">Яким транспортом заберете? *</legend>
          ${opt('vehicle', 'Вантажівка або тент', 'form.vehicle_truck', 'Вантажівка або тент', false, ' required')}
          ${opt('vehicle', 'Бус або Газель (1–2 біг-беги)', 'form.vehicle_van', 'Бус або Газель (1–2 біг-беги)', false)}
          ${opt('vehicle', 'Легковий причіп (1 біг-бег)', 'form.vehicle_trailer', 'Легковий причіп (1 біг-бег, причіп від 750 кг)', false)}
          ${opt('vehicle', 'Ще не знаю', 'form.vehicle_unsure', 'Ще не знаю, порадьте', false)}
        </fieldset>

        <fieldset class="form-group form-choice">
          <legend class="form-label" data-i18n="form.unload_label">Чим розвантажите біг-беги у себе? *</legend>
          <p class="form-hint" data-i18n="form.unload_hint">Біг-бег важить 650 кг, вручну його не зняти.</p>
          ${opt('unloading', 'Є навантажувач', 'form.unload_forklift', 'Є навантажувач', false, ' required')}
          ${opt('unloading', 'Є кран-маніпулятор', 'form.unload_crane', 'Є кран-маніпулятор', false)}
          ${opt('unloading', 'Техніки немає, потрібна порада', 'form.unload_none', 'Техніки немає, порадьте, як розвантажити', false)}
        </fieldset>
        <!-- /logistics -->`;
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

  // 5b. Buyer facts under the hero lead on sales pages (replaced in place on re-runs).
  if (page.interactive && html.includes('class="hero-lead"')) {
    const facts = buildFacts(page, html);
    if (html.includes('<!-- buy-facts')) {
      html = html.replace(/<!-- buy-facts[\s\S]*?<!-- \/buy-facts -->/, facts);
    } else {
      html = html.replace(/(<p class="hero-lead"[\s\S]*?<\/p>)/, `$1\n\n        ${facts}`);
    }
  }

  // 5c. Logistics questions in the quote form, right before the comment field.
  if (page.interactive && html.includes('id="modal-comment"')) {
    const logistics = buildLogistics(page);
    if (html.includes('<!-- logistics')) {
      html = html.replace(/<!-- logistics[\s\S]*?<!-- \/logistics -->/, logistics);
    } else {
      html = html.replace(/(\n[ \t]*)(<div class="form-group">\s*<label for="modal-comment")/, `$1${logistics}\n$1$2`);
    }
    if (!html.includes('<!-- logistics')) {
      console.error(`✗ ${file}: quote form comment field not found`);
      failed = true;
    }
  }

  // 6. One <main> landmark around the page content, so screen readers can jump past the header.
  if (!html.includes('<main')) {
    html = html.replace(/(<\/header>\n)/, '$1\n  <main id="main">\n').replace(/\n([ \t]*)<footer /, '\n  </main>\n\n$1<footer ');
  }

  // 7. Analytics setup scripts must not block the first paint.
  html = html.replace(/<script src="(\/assets\/js\/analytics(?:-config)?\.js\?v=[\w.-]+)"><\/script>/g, '<script defer src="$1"></script>');

  fs.writeFileSync(full, html);
  console.log(`✓ ${file}`);
}
process.exit(failed ? 1 : 0);
