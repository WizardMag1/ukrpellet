#!/usr/bin/env node
/**
 * Builds a landing page for every oblast centre in scripts/data/cities.cjs: pelety-<slug>.html, its Russian
 * strings in data/ru/translations.json (scripts/build-ru.cjs then writes ru/pelety-<slug>.html), the sitemap
 * entries, the "Доставка по містах України" list on /pelety-optom and the list in llms.txt.
 *
 * Why the pages are not copies with the name swapped: Google treats near-identical city pages as doorway pages.
 * Each page carries what is true only for that city, from assets/data/places.json (the calculator's road
 * distances): the distance from the warehouse, the economics of a load at that distance, and every town of
 * the oblast with its own distance. No delivered price is written into the page: it depends on the daily diesel
 * price, so the page links to the calculator with the city filled in instead.
 *
 * The page chrome (head, structured data, header, form, footer) is taken from pelety-kyiv.html, so the pages
 * follow it. Runs at the start of scripts/sync-layout.cjs; can also be run on its own.
 */
const fs = require('fs');
const path = require('path');
const { cities, updated } = require('./data/cities.cjs');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://ukrecopelleta.org';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== s) fs.writeFileSync(p, s);
};

const price = (JSON.parse(read('data/pricing.json')).pricing || {}).pine_uah_per_t;
if (!price) throw new Error('data/pricing.json: pricing.pine_uah_per_t missing');
const P = String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // 15000 -> "15 000"

// places.json: towns (type 2) with their road distance, grouped by oblast
const placesDoc = JSON.parse(read('assets/data/places.json'));
const towns = placesDoc.places
  .filter((r) => r[4] === 2)
  .map((r) => ({ uk: r[0], en: r[1], oblast: placesDoc.regions[r[2]][1], obEn: placesDoc.regions[r[2]][3], km: r[3] }));
const slugOf = (en) => en.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

// Ukrainian у/в: "у" before в/ф/у and after a consonant, "в" before a vowel and after a vowel
function uv(prev, next) {
  if (/^[ВвФфУу]/.test(next)) return 'у';
  if (/^[АаЕеЄєИиІіЇїОоЮюЯя]/.test(next)) return 'в';
  return /[аеєиіїоуюяАЕЄИІЇОУЮЯ]$/.test(prev) ? 'в' : 'у';
}
const at = (prev, word) => `${prev} ${uv(prev, word)} ${word}`; // "пелети" + "Вінниці" -> "пелети у Вінниці"
const oblGen = (o) => o.replace(/а$/, 'ої'); // Вінницька -> Вінницької
const oblLoc = (o) => o.replace(/а$/, 'ій'); // Вінницька -> Вінницькій

// Ukrainian -> Russian pairs for build-ru.cjs
const ru = {};
const t = (uk, r) => { ru[uk] = r; return uk; };
const keep = new Set(); // Ukrainian text that reads the same in Russian (town names, "541 км"): added only if missing
const same = (uk) => { if (!(uk in ru)) keep.add(uk); return uk; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const kmUk = (km) => same(`${km} км`);

const BASE_FILE = 'pelety-kyiv.html';
const base = read(BASE_FILE);
const must = (html, re, what) => {
  if (!re.test(html)) throw new Error(`build-cities: ${what} not found in ${BASE_FILE}`);
};

function resolve(c) {
  const row = towns.find((x) => x.uk === c.uk[0] && x.oblast === c.oblast);
  if (!row) throw new Error(`build-cities: ${c.uk[0]} (${c.oblast}) is not a town in places.json`);
  if (slugOf(row.en) !== c.slug) throw new Error(`build-cities: slug ${c.slug} != ${slugOf(row.en)} from places.json`);
  // places.json can list a town twice (e.g. Ананьїв, 515 and 517 km): keep each name once, at its shorter distance
  const byName = new Map();
  for (const x of towns) {
    if (x.oblast === c.oblast && x.uk !== c.uk[0] && !(byName.get(x.uk)?.km <= x.km)) byName.set(x.uk, x);
  }
  const others = [...byName.values()].sort((a, b) => a.km - b.km || a.uk.localeCompare(b.uk, 'uk'));
  return { ...c, km: row.km, obEn: row.obEn, others };
}

function texts(c) {
  const [N, L, D, G] = c.uk;
  const [rN, rIn, rTo, rG, rOb] = c.ru;
  const ob = oblGen(c.oblast);
  const km = c.km;
  let title = t(`Купити ${at('пелети', L)} — від ${P} грн/т, доставка`, `Купить пеллеты ${rIn} — от ${P} грн/т, доставка`);
  if (title.length > 60 || ru[title].length > 60) title = t(`Купити ${at('пелети', L)} — від ${P} грн/т`, `Купить пеллеты ${rIn} — от ${P} грн/т`);
  let desc = t(`Купити деревні пелети ${at('6 мм', L)} з доставкою від заводу (~${km} км). Біг-беги, безготівка з ПДВ, партії від 15 т. Замовляйте: +38 (066) 403-53-96.`,
    `Купить древесные пеллеты 6 мм ${rIn} с доставкой от завода (~${km} км). Биг-бэги, безнал с НДС, партии от 15 т. Заказывайте: +38 (066) 403-53-96.`);
  if (desc.length > 160 || ru[desc].length > 160) {
    desc = t(`Купити деревні пелети ${at('6 мм', L)} з доставкою від заводу (~${km} км). Біг-беги, безготівка з ПДВ, партії від 15 т. Тел.: +38 (066) 403-53-96.`,
      `Купить древесные пеллеты 6 мм ${rIn} с доставкой от завода (~${km} км). Биг-бэги, безнал с НДС, партии от 15 т. Тел.: +38 (066) 403-53-96.`);
  }
  for (const s of [title, ru[title]]) if (s.length > 60) throw new Error(`build-cities: title over 60 chars: ${s}`);
  for (const s of [desc, ru[desc]]) if (s.length > 160) throw new Error(`build-cities: description over 160 chars: ${s}`);

  // What a load costs per tonne depends on the distance; say what is cheapest at this one
  const tier = km < 300
    ? t(`До ${G} від заводу ~${km} км: доставка вигідна вже від 15 тонн (≈23 біг-беги).`,
      `До ${rG} от завода ~${km} км: доставка выгодна уже от 15 тонн (≈23 биг-бэга).`)
    : km <= 600
      ? t(`До ${G} ~${km} км дорогою, тому найвигідніше замовляти повну машину 22–24 т (≈34 біг-беги): так вартість перевезення на тонну найнижча.`,
        `До ${rG} ~${km} км по дороге, поэтому выгоднее всего заказывать полную машину 22–24 т (≈34 биг-бэга): так стоимость перевозки на тонну самая низкая.`)
      : t(`До ${G} ~${km} км дорогою. На таку відстань найвигідніша повна машина 22–24 т (≈34 біг-беги); кілька покупців можуть об’єднати замовлення в одну машину й розділити вартість перевезення.`,
        `До ${rG} ~${km} км по дороге. На такое расстояние выгоднее всего полная машина 22–24 т (≈34 биг-бэга); несколько покупателей могут объединить заказ в одну машину и разделить стоимость перевозки.`);

  const near = c.others.slice(0, 3);
  const nearUk = near.map((x) => `${x.uk} (~${x.km} км)`).join(', ');
  const faqTowns = near.length
    ? t(`Так, у будь-яке місто чи село області: ${nearUk} та інші — відстані в таблиці вище.`,
      `Да, в любой город или село области: ${nearUk} и другие — расстояния в таблице выше.`)
    : t('Так, у будь-яке місто чи село області. Ціну з доставкою покаже калькулятор.',
      'Да, в любой город или село области. Цену с доставкой покажет калькулятор.');

  return {
    N, title, desc,
    h1: t(`${at('Пелети', L)} з доставкою від виробника`, `Пеллеты ${rIn} с доставкой от производителя`),
    lead: t(`Прямі оптові поставки паливних деревних гранул 6 мм ENplus A1 із заводу в Нікополі до ${G} та ${ob} області — ~${km} км дорогою. Партії від 15 тонн, безготівковий розрахунок з ПДВ, паспорт якості на кожну партію.`,
      `Прямые оптовые поставки топливных древесных гранул 6 мм ENplus A1 с завода в Никополе до ${rG} и ${rOb} области — ~${km} км по дороге. Партии от 15 тонн, безналичный расчёт с НДС, паспорт качества на каждую партию.`),
    ldDesc: t(`Купити ${at('пелети', L)} від виробника: гранули 6 мм у біг-бегах, доставка від 15 тонн із заводу в Нікополі (~${km} км). Безготівковий розрахунок.`,
      `Купить пеллеты ${rIn} от производителя: гранулы 6 мм в биг-бэгах, доставка от 15 тонн с завода в Никополе (~${km} км). Безналичный расчёт.`),
    crumb: t(`Пелети ${N}`, `Пеллеты ${rN}`),
    areaCity: t(N, rN),
    areaObl: t(`${c.oblast} область`, `${rOb.replace(/ой$/, 'ая')} область`),
    delivH2: t(`Доставка ${at('пелет', D)}`, `Доставка пеллет ${rTo}`),
    delivLead: t(`Доставка ${uv('Доставка', D)} ${D} виконується партіями від 15 тонн (≈23 біг-беги по 650 кг) тентованими вантажівками 22–24 т.`,
      `Доставка ${rTo} выполняется партиями от 15 тонн (≈23 биг-бэга по 650 кг) тентованными грузовиками 22–24 т.`),
    tier,
    distLi: t(`Відстань від заводу ~${km} км`, `Расстояние от завода ~${km} км`),
    townsH2: t(`Доставка по ${oblLoc(c.oblast)} області`, `Доставка по ${rOb} области`),
    townsLead: t('Відстані дорогою від складу в Нікополі до міст області. Ціну з доставкою в будь-яке місто чи село області покаже калькулятор.',
      'Расстояния по дорогам от склада в Никополе до городов области. Цену с доставкой в любой город или село области покажет калькулятор.'),
    thTown: t('Місто', 'Город'),
    thKm: t('Відстань від складу', 'Расстояние от склада'),
    whoH2: t(`Кому ${uv('Кому', L)} ${L} підходять наші пелети`, `Кому ${rIn} подходят наши пеллеты`),
    q1: t(`Яка мінімальна партія пелет для доставки ${uv('доставки', D)} ${D}?`, `Какая минимальная партия пеллет для доставки ${rTo}?`),
    q2: t(`Скільки коштують пелети з доставкою ${uv('доставкою', D)} ${D}?`, `Сколько стоят пеллеты с доставкой ${rTo}?`),
    a2: t(`Ціна пелет — ${P} грн за тонну зі складу без ПДВ, плюс доставка за відстанню (~${km} км). Точний розрахунок — у калькуляторі або за телефоном +38 (066) 403-53-96.`,
      `Цена пеллет — ${P} грн за тонну со склада без НДС, плюс доставка по расстоянию (~${km} км). Точный расчёт — в калькуляторе или по телефону +38 (066) 403-53-96.`),
    q3: t(`Чи доставляєте ви в інші міста ${ob} області?`, `Доставляете ли вы в другие города ${rOb} области?`),
    a3: faqTowns,
    q4: t(`Чи працюєте ви з бюджетними установами ${G}?`, `Работаете ли вы с бюджетными учреждениями ${rG}?`),
  };
}

// Sentences shared with the other city pages; data/ru/translations.json already has them
const SHARED = {
  delivLead2: 'Дату та час розвантаження погоджуємо заздалегідь. Для підприємств і котелень із постійною потребою складаємо графік відвантажень на весь опалювальний сезон.',
  li1: 'Партія від 15 тонн',
  li2: 'Тентовані вантажівки 22–24 т',
  li4: 'Графік поставок на сезон',
  a1: '15 тонн (≈23 біг-беги). Менший обсяг — від одного біг-бега — можна забрати самовивозом зі складу заводу в Нікополі.',
  a4: 'Так, готуємо документи для закупівель через Prozorro. Оплата виключно безготівкова.',
};

function buildPage(c) {
  const x = texts(c);
  const url = `${SITE}/pelety-${c.slug}`;
  const calc = `/pellets?city=${c.slug}&amp;obl=${c.obEn}#calculator`;
  let html = base;

  const sub = (re, val, what) => {
    must(html, re, what);
    html = html.replace(re, val);
  };
  sub(/<title>[^<]*<\/title>/, `<title>${esc(x.title)}</title>`, '<title>');
  sub(/(<meta name="description" content=")[^"]*/, `$1${esc(x.desc)}`, 'meta description');
  sub(/(<meta property="og:title" content=")[^"]*/, `$1${esc(x.title)}`, 'og:title');
  sub(/(<meta property="og:description" content=")[^"]*/, `$1${esc(x.desc)}`, 'og:description');
  html = html.split('https://ukrecopelleta.org/pelety-kyiv').join(url).split('/ru/pelety-kyiv').join(`/ru/pelety-${c.slug}`);

  // Structured data, edited as data
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, open, body, close) => {
    const o = JSON.parse(body);
    if (o['@type'] === 'LocalBusiness') {
      o.areaServed = [{ '@type': 'AdministrativeArea', name: x.areaObl }, { '@type': 'City', name: x.areaCity }];
    } else if (o['@type'] === 'Product') {
      o.description = x.ldDesc;
    } else if (o['@type'] === 'BreadcrumbList') {
      o.itemListElement[o.itemListElement.length - 1].name = x.crumb;
    } else if (o['@type'] === 'FAQPage') {
      const qa = (q, a) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
      o.mainEntity = [qa(x.q1, SHARED.a1), qa(x.q2, x.a2), qa(x.q3, x.a3), qa(x.q4, SHARED.a4)];
    }
    return `${open}\n${JSON.stringify(o, null, 2)}\n${close}`;
  });

  sub(/(› <span>)Пелети Київ(<\/span>)/, `$1${esc(x.crumb)}$2`, 'breadcrumb');
  sub(/(<h1 class="hero-title">)[^<]*(<\/h1>)/, `$1${esc(x.h1)}$2`, 'h1');
  sub(/(<h1 class="hero-title">[^<]*<\/h1>\s*<p class="hero-lead">)[^<]*(<\/p>)/, `$1${esc(x.lead)}$2`, 'hero-lead');
  html = html.split('/pellets?city=kyiv#calculator').join(calc);

  // Body: from the delivery section to the end of the FAQ
  const start = html.indexOf('<section class="section">\n    <div class="container">\n        <h2 class="section-title">Доставка пелет у Київ</h2>');
  const end = html.indexOf('<section class="section section-dark" id="contacts">');
  if (start < 0 || end < 0) throw new Error(`build-cities: delivery section or contacts not found in ${BASE_FILE}`);
  const qualityStart = html.indexOf('<section class="section">\n    <div class="container">\n        <h2 class="section-title">Якість і документи</h2>', start);
  const qualityEnd = html.indexOf('</section>', qualityStart) + '</section>'.length;
  const whoStart = html.indexOf('<section class="section section-subtle">', start);
  const whoBody = html.slice(html.indexOf('</h2>', whoStart) + 5, html.indexOf('</div>\n  </section>', whoStart));
  if (qualityStart < 0 || whoStart < 0 || whoStart > qualityStart) throw new Error(`build-cities: who/quality sections not found in ${BASE_FILE}`);

  const rows = c.others.map((o) => `            <tr><td>${esc(same(o.uk))}</td><td>${kmUk(o.km)}</td></tr>`).join('\n');
  const body = `<section class="section">
    <div class="container">
        <h2 class="section-title">${esc(x.delivH2)}</h2>
        <p class="lead">${esc(x.delivLead)}</p>
        <p class="lead">${esc(x.tier)}</p>
        <p class="lead">${esc(SHARED.delivLead2)}</p>
        <ul class="fact-list">
          <li>${SHARED.li1}</li>
          <li>${SHARED.li2}</li>
          <li>${esc(x.distLi)}</li>
          <li>${SHARED.li4}</li>
        </ul>
    </div>
  </section>

  <section class="section section-subtle">
    <div class="container">
        <h2 class="section-title">${esc(x.townsH2)}</h2>
        <p class="lead">${esc(x.townsLead)}</p>
        <table class="km-table">
          <thead><tr><th scope="col">${x.thTown}</th><th scope="col">${esc(x.thKm)}</th></tr></thead>
          <tbody>
            <tr><td>${esc(t(c.uk[0], c.ru[0]))}</td><td>${kmUk(c.km)}</td></tr>
${rows}
          </tbody>
        </table>
        <p><a href="${calc}">${t('Розрахувати ціну з доставкою', 'Рассчитать цену с доставкой')}</a></p>
    </div>
  </section>

  <section class="section">
    <div class="container">
        <h2 class="section-title">${esc(x.whoH2)}</h2>${whoBody}</div>
  </section>

  ${html.slice(qualityStart, qualityEnd).replace('class="section"', 'class="section section-subtle"')}

  <section class="section" id="faq">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">Відповіді на запитання покупців</h2>
      </div>
      <div class="faq-list">
        <details class="faq-item" open>
          <summary class="faq-summary">${esc(x.q1)}</summary>
          <div class="faq-content">${SHARED.a1}</div>
        </details>
        <details class="faq-item">
          <summary class="faq-summary">${esc(x.q2)}</summary>
          <div class="faq-content">${esc(x.a2)}</div>
        </details>
        <details class="faq-item">
          <summary class="faq-summary">${esc(x.q3)}</summary>
          <div class="faq-content">${esc(x.a3)}</div>
        </details>
        <details class="faq-item">
          <summary class="faq-summary">${esc(x.q4)}</summary>
          <div class="faq-content">${SHARED.a4}</div>
        </details>
      </div>
      <nav class="see-also" aria-label="Інші сторінки">
        <p>Також дивіться</p>
        <ul>
          <li><a href="/pelety-optom#cities">${t('Доставка в інші міста України', 'Доставка в другие города Украины')}</a></li>
          <li><a href="/pelety-optom">Пелети оптом</a></li>
          <li><a href="/pelety-nikopol">Пелети Нікополь</a></li>
          <li><a href="${calc}">Калькулятор партії</a></li>
        </ul>
      </nav>
    </div>
  </section>

  `;
  html = html.slice(0, start) + body + html.slice(end);

  // Nothing about Kyiv may be left above the footer (the footer's city links are stamped by sync-layout)
  const content = html.slice(0, html.indexOf('<footer'));
  const left = content.match(/[^>"]{0,40}(?:Києв|Київ)[^<"]{0,40}/g);
  if (left) throw new Error(`build-cities: pelety-${c.slug}: Kyiv text left from ${BASE_FILE}: ${left.join(' | ')}`);
  return html;
}

const built = cities.map(resolve);
for (const c of built) write(`pelety-${c.slug}.html`, buildPage(c));

// The city list on /pelety-optom: every city page with its distance
const ALL = [
  ['nikopol', 'Пелети Нікополь', 'самовивіз'],
  ['zaporizhzhia', 'Пелети Запоріжжя', 82],
  ['kryvyi-rih', 'Пелети Кривий Ріг', 100],
  ['dnipro', 'Пелети Дніпро та область', 125],
  ['kamianske', "Пелети Кам'янське", 150],
  ['pavlohrad', 'Пелети Павлоград', 200],
  ['kyiv', 'Пелети Київ', 600],
  ...built.map((c) => [c.slug, t(`Пелети ${c.uk[0]}`, `Пеллеты ${c.ru[0]}`), c.km]),
].sort((a, b) => (typeof a[2] === 'number' ? a[2] : 0) - (typeof b[2] === 'number' ? b[2] : 0));
t('самовивіз', 'самовывоз');
const list = `<!-- cities: generated by scripts/build-cities.cjs -->
  <section class="section section-subtle" id="cities">
    <div class="container">
        <h2 class="section-title">${t('Доставка пелет по містах України', 'Доставка пеллет по городам Украины')}</h2>
        <p class="lead">${t('Відстань дорогою від заводу в Нікополі. Ціну з доставкою в будь-яке місто чи село покаже калькулятор.', 'Расстояние по дороге от завода в Никополе. Цену с доставкой в любой город или село покажет калькулятор.')}</p>
        <ul class="city-list">
${ALL.map(([slug, label, km]) => `          <li><a href="/pelety-${slug}">${esc(label)}</a> <span>${typeof km === 'number' ? kmUk(km) : km}</span></li>`).join('\n')}
        </ul>
    </div>
  </section>
  <!-- /cities -->

  `;
let optom = read('pelety-optom.html');
if (optom.includes('<!-- cities: generated')) optom = optom.replace(/<!-- cities: generated[\s\S]*?<!-- \/cities -->\n\n  /, list);
else optom = optom.replace('<section class="section" id="faq">', `${list}<section class="section" id="faq">`);
if (!optom.includes('id="cities"')) throw new Error('build-cities: FAQ section not found in pelety-optom.html');
write('pelety-optom.html', optom);

// Sitemap entries for the city pages, Ukrainian and Russian
const entry = (loc, slug) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${updated}</lastmod>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="uk" href="${SITE}/pelety-${slug}" />
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE}/ru/pelety-${slug}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/pelety-${slug}" />
  </url>`;
const block = `  <!-- cities: generated by scripts/build-cities.cjs -->
${built.map((c) => entry(`${SITE}/pelety-${c.slug}`, c.slug)).join('\n')}
${built.map((c) => entry(`${SITE}/ru/pelety-${c.slug}`, c.slug)).join('\n')}
  <!-- /cities -->
`;
let sitemap = read('sitemap.xml');
if (sitemap.includes('<!-- cities: generated')) sitemap = sitemap.replace(/  <!-- cities: generated[\s\S]*?<!-- \/cities -->\n/, block);
else sitemap = sitemap.replace('</urlset>', `${block}</urlset>`);
write('sitemap.xml', sitemap);

// llms.txt: the city pages, for AI assistants
const llmsBlock = `<!-- cities: generated by scripts/build-cities.cjs -->
${built.map((c) => `- [Пелети ${c.uk[0]} (доставка ~${c.km} км від заводу)](${SITE}/pelety-${c.slug})`).join('\n')}
<!-- /cities -->`;
let llms = read('llms.txt');
if (llms.includes('<!-- cities: generated')) llms = llms.replace(/<!-- cities: generated[\s\S]*?<!-- \/cities -->/, llmsBlock);
else llms = llms.replace(/(- \[Пелети Київ[^\n]*\n)/, `$1${llmsBlock}\n`);
if (!llms.includes('<!-- cities: generated')) throw new Error('build-cities: Kyiv line not found in llms.txt');
write('llms.txt', llms);

// Russian strings for build-ru.cjs, kept in key order so the file only changes when a string does
const dictFile = 'data/ru/translations.json';
const dict = JSON.parse(read(dictFile));
let changed = false;
for (const [k, v] of Object.entries(ru)) {
  if (dict[k] !== v) { dict[k] = v; changed = true; }
}
for (const k of keep) {
  if (!(k in dict) && !(k in ru)) { dict[k] = k; changed = true; }
}
if (changed) write(dictFile, `${JSON.stringify(dict, null, 2)}\n`);

console.log(`✓ ${built.length} city pages (scripts/build-cities.cjs)`);
module.exports = { slugs: built.map((c) => c.slug) };
