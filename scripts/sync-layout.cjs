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

const ASSET_VERSION = '20260927-7';
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
            <dd><strong>${priceText()}</strong> <span data-i18n="facts.price_unit">грн/т зі складу, без ПДВ</span><br><a href="${calc}" data-i18n="facts.price_link">Розрахувати з доставкою</a></dd>
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

// Quote form logistics: when, delivery or pickup, and what each side needs to load or unload 650 kg bags.
// Pickup asks for the vehicle, its capacity, where it opens and what help is needed at the warehouse (our
// forklift, tractor and crane work in production, so help is confirmed by email). Delivery asks whether a
// 20 t truck can reach the site and what the buyer unloads with. main.js shows the matching questions,
// warns about combinations that won't work and sends the answers to the sales team.
// Values stay in Ukrainian (they go to the sales team); visible labels are translated by i18n.js.
function buildLogistics(page) {
  const pickup = page.city === 'nikopol_pickup';
  const choice = (type, name, value, key, label, { checked = false, required = false, exclusive = false } = {}) =>
    `<label class="form-choice-opt"><input type="${type}" name="${name}" value="${value}"${checked ? ' checked' : ''}${required ? ' required' : ''}${exclusive ? ' data-exclusive' : ''}> <span data-i18n="${key}">${label}</span></label>`;
  const radio = (...a) => choice('radio', ...a);
  const check = (...a) => choice('checkbox', ...a);
  const only = (mode) => ` data-receive="${mode}"${(mode === 'Самовивіз') === pickup ? '' : ' hidden disabled'}`;
  return `<!-- logistics: generated by scripts/sync-layout.cjs -->
        <div class="logistics">
        <fieldset class="form-group form-choice" data-label="Отримання">
          <legend class="form-label" data-i18n="form.receive_label">Як отримаєте пелети? *</legend>
          ${radio('receive', 'Доставка', 'form.receive_delivery', 'Доставка нашою вантажівкою', { checked: !pickup, required: true })}
          ${radio('receive', 'Самовивіз', 'form.receive_pickup', 'Самовивіз зі складу в Нікополі', { checked: pickup })}
        </fieldset>

        <fieldset class="form-group form-choice form-when">
          <legend class="form-label" data-i18n="form.when_label">Коли вам зручно? *</legend>
          <div class="form-row">
            <label class="form-sub" data-label="Дата"><span data-i18n="form.when_date">Дата</span>
              <input type="date" name="date" class="form-control" required></label>
            <label class="form-sub" data-label="Час"><span data-i18n="form.when_time">Час</span>
              <select name="time" class="form-control">
                <option value="До обіду" data-i18n="form.time_am">До обіду</option>
                <option value="Після обіду" data-i18n="form.time_pm">Після обіду</option>
                <option value="Узгодимо телефоном" data-i18n="form.time_call" selected>Узгодимо телефоном</option>
              </select></label>
          </div>
        </fieldset>

        <fieldset class="form-group form-choice" data-label="Транспорт клієнта"${only('Самовивіз')}>
          <legend class="form-label" data-i18n="form.vehicle_label">Яким транспортом заберете? *</legend>
          ${radio('vehicle', 'Тентована фура або вантажівка', 'form.vehicle_tent', 'Тентована фура або вантажівка', { required: true })}
          ${radio('vehicle', 'Бортова вантажівка', 'form.vehicle_flatbed', 'Бортова вантажівка')}
          ${radio('vehicle', 'Фургон або бус (двері лише ззаду)', 'form.vehicle_van', 'Фургон або бус (двері лише ззаду)')}
          ${radio('vehicle', 'Самоскид', 'form.vehicle_tipper', 'Самоскид')}
          ${radio('vehicle', 'Легковий причіп', 'form.vehicle_trailer', 'Легковий причіп (1 біг-бег)')}
          ${radio('vehicle', 'Ще не знаю', 'form.vehicle_unsure', 'Ще не знаю, порадьте')}
        </fieldset>

        <div class="form-group" data-label="Вантажопідйомність, т"${only('Самовивіз')}>
          <label for="modal-capacity" class="form-label" data-i18n="form.capacity_label">Вантажопідйомність транспорту, т</label>
          <input type="number" id="modal-capacity" name="capacity" class="form-control" min="0.3" max="60" step="0.1" inputmode="decimal" placeholder="20">
        </div>

        <fieldset class="form-group form-choice" data-label="Звідки завантажувати" data-need-one${only('Самовивіз')}>
          <legend class="form-label" data-i18n="form.opening_label">Звідки можна завантажити транспорт? *</legend>
          <div class="form-choice-grid">
          ${check('opening', 'Збоку (зліва або справа)', 'form.opening_side', 'Збоку (зліва або справа)')}
          ${check('opening', 'Ззаду', 'form.opening_rear', 'Ззаду')}
          ${check('opening', 'Зверху (знімається тент або дах)', 'form.opening_top', 'Зверху (знімається тент або дах)')}
          </div>
        </fieldset>

        <fieldset class="form-group form-choice" data-label="Допомога на складі" data-need-one${only('Самовивіз')}>
          <legend class="form-label" data-i18n="form.help_label">Що потрібно від нас на складі? *</legend>
          <p class="form-hint" data-i18n="form.help_hint">Наша техніка працює на виробництві, тому допомогу й час підтверджуємо окремо листом на email.</p>
          <div class="form-choice-grid">
          ${check('help', 'Навантажувач', 'form.help_forklift', 'Навантажувач')}
          ${check('help', 'Трактор із фронтальним навантажувачем', 'form.help_tractor', 'Трактор із фронтальним навантажувачем')}
          ${check('help', 'Кран', 'form.help_crane', 'Кран (для завантаження зверху)')}
          ${check('help', 'Нічого, завантажимо самі', 'form.help_none', 'Нічого, завантажимо самі', { exclusive: true })}
          </div>
        </fieldset>

        <fieldset class="form-group form-choice" data-label="Під'їзд для фури 20 т"${only('Доставка')}>
          <legend class="form-label" data-i18n="form.access_label">Чи під'їде фура 20 т до місця розвантаження? *</legend>
          ${radio('access', 'Так', 'form.access_yes', 'Так', { required: true })}
          ${radio('access', 'Ні, потрібна менша машина', 'form.access_no', 'Ні, потрібна менша машина')}
          ${radio('access', 'Не знаю', 'form.access_unsure', 'Не знаю')}
        </fieldset>

        <fieldset class="form-group form-choice" data-label="Розвантаження"${only('Доставка')}>
          <legend class="form-label" data-i18n="form.unload_label">Чим розвантажите біг-беги у себе? *</legend>
          <p class="form-hint" data-i18n="form.unload_hint">Біг-бег важить 650 кг, вручну його не зняти.</p>
          ${radio('unloading', 'Є навантажувач', 'form.unload_forklift', 'Є навантажувач', { required: true })}
          ${radio('unloading', 'Є трактор із фронтальним навантажувачем', 'form.unload_tractor', 'Є трактор із фронтальним навантажувачем')}
          ${radio('unloading', 'Є кран-маніпулятор', 'form.unload_crane', 'Є кран-маніпулятор')}
          ${radio('unloading', 'Техніки немає, потрібна порада', 'form.unload_none', 'Техніки немає, порадьте, як розвантажити')}
        </fieldset>

        <div class="form-group" data-label="Людей у клієнта">
          <label for="modal-people" class="form-label" data-i18n="form.people_label">Скільки ваших людей буде на місці?</label>
          <input type="number" id="modal-people" name="people" class="form-control" min="0" max="50" step="1" inputmode="numeric" placeholder="2">
        </div>

        <ul class="form-warn" data-logistics-warn role="status" aria-live="polite" hidden></ul>
        </div>
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
