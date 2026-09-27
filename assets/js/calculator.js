/**
 * UkrEcoPelleta & ТОВ «УКРЕКОПЕЛЕТА» — Interactive Pellet Volume & Regional Logistics Calculator
 */

document.addEventListener('DOMContentLoaded', () => {
  const tonsSlider = document.getElementById('calc-tons-slider');
  const tonsInput = document.getElementById('calc-tons-input');
  const modeRadios = document.querySelectorAll('input[name="calc-mode"]');
  const placeGroup = document.getElementById('calc-place-group');
  const placeInput = document.getElementById('calc-place-input');
  const placeList = document.getElementById('calc-place-list');
  const placeHint = document.getElementById('calc-place-hint');

  const resTons = document.getElementById('res-total-tons');
  const resBags = document.getElementById('res-big-bags');
  const resEnergy = document.getElementById('res-energy-val');
  const resHeatOutput = document.getElementById('res-heat-output');
  const minOrderAlert = document.getElementById('min-order-alert');
  const calcOrderBtn = document.getElementById('calc-order-btn');
  const effSelect = document.getElementById('calc-eff-select');
  const productSelect = document.getElementById('calc-product-select');
  const resPrice = document.getElementById('res-price-per-t');
  const resTotal = document.getElementById('res-total-price');
  const resGoods = document.getElementById('res-goods-total');
  const resDelivery = document.getElementById('res-delivery');
  const resDeliveryLabel = document.getElementById('res-delivery-label');
  const resDeliveryBreakdown = document.getElementById('res-delivery-breakdown');
  const resPerTDelivered = document.getElementById('res-per-t-delivered');
  const priceNote = document.getElementById('calc-price-note');

  // Diesel price: /data/fuel.json is refreshed daily by .github/workflows/fuel-price.yml (rises apply at once,
  // drops only after a week). analytics-config.js holds the fallback if that file can't be read.
  // We price at the national average plus a markup: the cheapest stations are not on every route.
  let fuelFile = null;
  function diesel() {
    const d = window.APP_CONFIG?.DELIVERY || {};
    const markup = d.diesel_markup_uah_per_l || 0;
    const [market, date] = fuelFile
      ? [fuelFile.diesel_uah_per_l, fuelFile.checked_date || fuelFile.effective_date]
      : [d.diesel_uah_per_l, d.diesel_date];
    return { market, markup, price: market + markup, date, live: !!fuelFile };
  }

  // Delivery = own truck cost: fuel for the loaded run and the empty return, plus driver pay per km,
  // and never less than the minimum per order. Truck inputs live in analytics-config.js (APP_CONFIG.DELIVERY).
  function deliveryCost(km, bags) {
    const d = window.APP_CONFIG?.DELIVERY;
    if (!d) return null;
    const trucks = Math.max(1, Math.ceil(bags / d.bags_per_truck));
    const litres = km * (d.consumption_loaded_l_per_100km + d.consumption_empty_l_per_100km) / 100;
    const fuel = trucks * litres * diesel().price;
    const driver = trucks * 2 * km * d.driver_uah_per_km;
    const cost = Math.round((fuel + driver) / 10) * 10;
    const min = d.min_delivery_uah || 0;
    return { trucks, fuel, driver, total: Math.max(cost, min), atMinimum: cost < min, min };
  }

  // Write plain text into a field that is otherwise rolled, so the next roll starts clean
  function setText(el, text) {
    if (!el) return;
    rolls.delete(el);
    el.textContent = text;
  }

  // Indicative ex-warehouse prices live in analytics-config.js (APP_CONFIG.PRICING)
  function pricePerTonne() {
    const pricing = window.APP_CONFIG?.PRICING || {};
    const product = productSelect ? productSelect.value : 'pine';
    return product === 'acacia_elm' ? pricing.acacia_elm_uah_per_t : pricing.pine_uah_per_t;
  }

  // Heat-output classes: net usable heat fraction per boiler/dryer type
  const EFF_CLASS = {
    e1: 0.92, // premium pellet boiler / grain dryer
    e2: 0.85, // standard pellet boiler (default)
    e3: 0.78  // industrial boiler / dryer
  };

  if (!tonsSlider || !tonsInput) return;

  // i18n.js declares `translations` / `currentLang` as script globals; fall back to Ukrainian if absent.
  function lang() {
    return typeof currentLang !== 'undefined' ? currentLang : 'uk';
  }

  function t(key) {
    const dict = typeof translations !== 'undefined' ? translations : null;
    return (dict && (dict[lang()]?.[key] || dict.uk?.[key])) || '';
  }

  function currentEff() {
    return effSelect && EFF_CLASS[effSelect.value] ? EFF_CLASS[effSelect.value] : EFF_CLASS.e2;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Result numbers roll from their previous value so a change reads as a change.
  // Each call cancels the previous roll on the same element, so dragging the slider stays smooth.
  const ROLL_MS = 320;
  const rolls = new Map();
  function roll(el, to, render) {
    if (!el) return;
    const prev = rolls.get(el);
    if (prev) cancelAnimationFrame(prev.raf);
    const from = prev ? prev.value : to;
    if (from === to || reduceMotion.matches || !prev) {
      rolls.set(el, { value: to, raf: 0 });
      el.textContent = render(to);
      return;
    }
    // Time only from rAF timestamps: mixing them with performance.now() lets the two clocks disagree.
    let start = null;
    const state = { value: from, raf: 0 };
    rolls.set(el, state);
    const step = (now) => {
      if (start === null) start = now;
      const p = Math.min(Math.max((now - start) / ROLL_MS, 0), 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      state.value = from + (to - from) * eased;
      el.textContent = render(state.value);
      if (p < 1) state.raf = requestAnimationFrame(step);
      else state.value = to;
    };
    state.raf = requestAnimationFrame(step);
  }

  // Load plan: one row per truck. Bag weight and bags per truck come from APP_CONFIG.DELIVERY
  // (650 kg bags, 26 on a 13.6 m curtain-sider); the mark sits at the 15 t delivery minimum.
  const KG_PER_BAG = window.APP_CONFIG?.DELIVERY?.bag_kg || 650;
  const BAGS_PER_TRUCK = window.APP_CONFIG?.DELIVERY?.bags_per_truck || 26;
  const MAX_ROWS = 5;
  const MIN_DELIVERY_BAGS = Math.round(15 * 1000 / KG_PER_BAG);
  const bagsFor = (tons) => Math.round(tons * 1000 / KG_PER_BAG);
  const loadPlan = document.getElementById('load-plan');
  const loadRows = document.getElementById('load-plan-rows');
  const loadSummary = document.getElementById('load-plan-summary');
  let filledBefore = 0;
  if (loadPlan) {
    loadPlan.style.setProperty('--bags-per-truck', BAGS_PER_TRUCK);
    loadPlan.style.setProperty('--min-bags', MIN_DELIVERY_BAGS);
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function renderLoadPlan(bags, isPickup) {
    if (!loadPlan || !loadRows) return;
    const trucks = Math.max(1, Math.ceil(bags / BAGS_PER_TRUCK));
    const rows = Math.min(trucks, MAX_ROWS);

    while (loadRows.querySelectorAll('.truck').length < rows) {
      const row = document.createElement('div');
      row.className = 'truck';
      const label = document.createElement('span');
      label.className = 'truck-label';
      label.textContent = String(loadRows.querySelectorAll('.truck').length + 1);
      const bed = document.createElement('div');
      bed.className = 'truck-bed';
      for (let i = 0; i < BAGS_PER_TRUCK; i++) {
        const bag = document.createElement('i');
        bag.className = 'bag';
        bed.appendChild(bag);
      }
      row.append(label, bed);
      loadRows.insertBefore(row, loadRows.querySelector('.truck-more'));
    }
    const rowEls = loadRows.querySelectorAll('.truck');
    for (let r = rowEls.length - 1; r >= rows; r--) rowEls[r].remove();
    // Commit the empty state of freshly created bags, otherwise they skip their drop-in transition.
    void loadRows.offsetHeight;

    // Newly loaded bags drop in one after another; unloading is immediate (exit faster than entrance).
    const cells = loadRows.querySelectorAll('.bag');
    for (let i = 0; i < cells.length; i++) {
      const filled = i < bags;
      const order = i - filledBefore;
      cells[i].style.transitionDelay = filled && order > 0 ? `${Math.min(order, 12) * 14}ms` : '0ms';
      cells[i].classList.toggle('is-filled', filled);
    }
    filledBefore = Math.min(bags, cells.length);

    let more = loadRows.querySelector('.truck-more');
    if (trucks > MAX_ROWS) {
      if (!more) {
        more = document.createElement('div');
        more.className = 'truck-more';
        loadRows.appendChild(more);
      }
      const extra = trucks - MAX_ROWS;
      more.textContent = lang() === 'en'
        ? `+ ${extra} more ${extra === 1 ? 'truck' : 'trucks'}`
        : `+ ще ${extra} ${plural(extra, 'фура', 'фури', 'фур')}`;
    } else if (more) {
      more.remove();
    }

    loadPlan.classList.toggle('is-pickup', isPickup);
    loadPlan.classList.toggle('is-under', !isPickup && bags < MIN_DELIVERY_BAGS);

    if (loadSummary) {
      loadSummary.textContent = lang() === 'en'
        ? `${bags} ${bags === 1 ? 'big bag' : 'big bags'}, ${trucks} ${trucks === 1 ? 'truck' : 'trucks'}`
        : `${bags} ${plural(bags, 'біг-бег', 'біг-беги', 'біг-бегів')}, ${trucks} ${plural(trucks, 'фура', 'фури', 'фур')}`;
    }
  }

  function updateCalculations() {
    let tons = parseFloat(tonsInput.value) || 15;
    if (tons < 1) tons = 1;
    if (tons > 500) tons = 500;

    tonsSlider.value = tons;
    tonsInput.value = tons;

    const bigBags = bagsFor(tons);

    // Thermal energy (approx 4.9 kWh/kg => ~4.95 MWh / ton => ~4.25 Gcal / ton; Gcal derived below)
    const eff = currentEff();
    const grossMwh = tons * 4.95;

    const en = lang() === 'en';
    const u = en
      ? { t: 't', pcs: 'pcs', mwh: 'MWh', gcal: 'Gcal' }
      : { t: 'т', pcs: 'шт', mwh: 'МВт·год', gcal: 'Гкал' };

    // Energy rolls as one number (MWh); Gcal is derived so both halves always agree.
    const GCAL_PER_MWH = 4.25 / 4.95;
    const energyText = (m) => `~${m.toFixed(1)} ${u.mwh} (${(m * GCAL_PER_MWH).toFixed(1)} ${u.gcal})`;

    roll(resTons, tons, (v) => `${Math.round(v)} ${u.t}`);
    roll(resBags, bigBags, (v) => `${Math.round(v)} ${u.pcs}`);
    roll(resEnergy, grossMwh, energyText);
    roll(resHeatOutput, grossMwh * eff, energyText);

    // Destination: delivery to a chosen place, pickup at the Nikopol warehouse, or export (priced on request)
    const mode = currentMode();
    const isNikopolPickup = mode === 'pickup';
    if (placeGroup) placeGroup.hidden = mode !== 'delivery';

    const price = pricePerTonne();
    if (price) {
      const money = new Intl.NumberFormat(en ? 'en-US' : 'uk-UA', { maximumFractionDigits: 0 });
      const uah = (v) => (en ? `UAH ${money.format(Math.round(v))}` : `${money.format(Math.round(v))} грн`);
      const goods = price * tons;
      roll(resPrice, price, uah);
      roll(resGoods, goods, uah);

      const cfg = window.APP_CONFIG?.DELIVERY || {};
      let km = mode === 'delivery' && selectedPlace ? Math.max(selectedPlace.km, 1) : null;
      const delivery = isNikopolPickup ? { total: 0 } : km == null ? null : deliveryCost(km, bigBags);

      if (isNikopolPickup) {
        setText(resDeliveryLabel, en ? 'Delivery:' : 'Доставка:');
        setText(resDelivery, en ? 'pickup, free' : 'самовивіз, 0 грн');
        setText(resDeliveryBreakdown, '');
      } else if (!delivery) {
        setText(resDeliveryLabel, en ? 'Delivery:' : 'Доставка:');
        setText(resDelivery, mode === 'export' ? (en ? 'on request' : 'за запитом') : (en ? 'choose a place' : 'оберіть населений пункт'));
        setText(resDeliveryBreakdown, '');
      } else {
        km = Math.round(km);
        const trucksWord = en ? (delivery.trucks === 1 ? 'truck' : 'trucks') : plural(delivery.trucks, 'фура', 'фури', 'фур');
        setText(resDeliveryLabel, en ? `Delivery (${km} km, ${delivery.trucks} ${trucksWord}):` : `Доставка (${km} км, ${delivery.trucks} ${trucksWord}):`);
        roll(resDelivery, delivery.total, uah);
        setText(resDeliveryBreakdown, delivery.atMinimum
          ? (en ? `minimum delivery charge per order (fuel ${uah(delivery.fuel)}, driver ${uah(delivery.driver)})`
            : `мінімальна вартість доставки на замовлення (паливо ${uah(delivery.fuel)}, водій ${uah(delivery.driver)})`)
          : (en ? `fuel ${uah(delivery.fuel)}, driver ${uah(delivery.driver)}`
            : `паливо ${uah(delivery.fuel)}, водій ${uah(delivery.driver)}`));
      }

      const total = goods + (delivery ? delivery.total : 0);
      roll(resTotal, total, uah);
      setText(resPerTDelivered, isNikopolPickup
        ? (en ? 'pickup from the Nikopol warehouse' : 'самовивіз зі складу в Нікополі')
        : delivery
          ? (en ? `≈ ${uah(total / tons)} per tonne delivered` : `≈ ${uah(total / tons)} за тонну з доставкою`)
          : (en ? 'without delivery' : 'без доставки'));

      if (priceNote) {
        const f = diesel();
        const [y, m, dd] = String(f.date).split('-');
        const fmt = new Intl.NumberFormat(en ? 'en-US' : 'uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const minText = cfg.min_delivery_uah ? uah(cfg.min_delivery_uah) : '';
        priceNote.textContent = en
          ? `Diesel ${fmt.format(f.price)} UAH/l: the average Ukrainian pump price (Minfin, ${fmt.format(f.market)}, checked ${dd}.${m}.${y}) plus ${f.markup} UAH. ${minText ? `Delivery costs at least ${minText} per order. ` : ''}Prices exclude VAT. Road distances © OpenStreetMap. Estimate only; our sales manager confirms the exact price.`
          : `Дизель ${fmt.format(f.price)} грн/л: середня ціна на АЗС України (Мінфін, ${fmt.format(f.market)}, перевірено ${dd}.${m}.${y}) плюс ${f.markup} грн. ${minText ? `Доставка на замовлення — від ${minText}. ` : ''}Ціни без ПДВ. Відстані дорогами © OpenStreetMap. Розрахунок орієнтовний, точну ціну підтвердить менеджер.`;
      }
    }
    const meetsMinOrder = tons >= 15;

    renderLoadPlan(bigBags, isNikopolPickup);

    if (minOrderAlert) {
      const key = isNikopolPickup ? 'calc.min_alert_pickup' : meetsMinOrder ? 'calc.min_alert_ok' : 'calc.min_alert_warn';
      minOrderAlert.className = `min-order-indicator ${meetsMinOrder || isNikopolPickup ? 'min-order-ok' : 'min-order-warn'}`;
      minOrderAlert.textContent = t(key);
    }
  }

  // ---- Destination: mode + place search ------------------------------------------------------------
  // places.json (built by scripts/build-places.cjs): every settlement in government-controlled Ukraine
  // with its road distance from the warehouse. It is fetched when the buyer starts typing.

  function currentMode() {
    const checked = document.querySelector('input[name="calc-mode"]:checked');
    return checked ? checked.value : 'delivery';
  }

  // City pages link here as /pellets?city=dnipro#calculator. Distances match places.json so the
  // calculator can show a price before that file has loaded.
  const PRESETS = {
    dnipro: ['Дніпро', 'Dnipro', ['Дніпровський', 'Дніпропетровська', 'Dniprovskyi', 'Dnipropetrovska'], 2],
    kamianske: ['Кам’янське', 'Kamianske', ['Кам’янський', 'Дніпропетровська', 'Kamianskyi', 'Dnipropetrovska'], 2],
    kryvyi_rih: ['Кривий Ріг', 'Kryvyi Rih', ['Криворізький', 'Дніпропетровська', 'Kryvorizkyi', 'Dnipropetrovska'], 2],
    pavlohrad: ['Павлоград', 'Pavlohrad', ['Павлоградський', 'Дніпропетровська', 'Pavlohradskyi', 'Dnipropetrovska'], 2],
    novomoskovsk: ['Самар', 'Samar', ['Самарівський', 'Дніпропетровська', 'Samarivskyi', 'Dnipropetrovska'], 2],
    nikopol_deliv: ['Нікополь', 'Nikopol', ['Нікопольський', 'Дніпропетровська', 'Nikopolskyi', 'Dnipropetrovska'], 2],
    marhanets: ['Марганець', 'Marhanets', ['Нікопольський', 'Дніпропетровська', 'Nikopolskyi', 'Dnipropetrovska'], 2],
    pokrov: ['Покров', 'Pokrov', ['Нікопольський', 'Дніпропетровська', 'Nikopolskyi', 'Dnipropetrovska'], 2],
  };
  const presetKm = window.APP_CONFIG?.DELIVERY?.distances_km || {};
  const toPlace = ([uk, en, region, type], km) => ({ uk, en, region, km, type });

  let selectedPlace = null;
  const places = { rows: null, keys: null, loading: null, failed: false };
  let results = [];
  let active = -1;

  // Fold spelling variants so "Никополь", "нікополь" and "Nikopol" all find Нікополь
  function norm(str) {
    return String(str).toLowerCase()
      .replace(/[’ʼ'`"]/g, '')
      .replace(/[ёєэ]/g, 'е')
      .replace(/[іїйы]/g, 'и')
      .replace(/ґ/g, 'г')
      .replace(/ъ/g, '')
      .replace(/[-‐–]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function placeName(p) {
    return lang() === 'en' ? p.en : p.uk;
  }

  function regionLabel(r) {
    if (lang() === 'en') return r[2] === r[3] ? r[3] : `${r[2]} district, ${r[3]} Oblast`;
    return r[0] === r[1] ? `м. ${r[1]}` : `${r[0]} р-н, ${r[1]} обл.`;
  }

  function typeWord(type) {
    const en = lang() === 'en';
    return type === 2 ? (en ? 'town' : 'місто') : type === 1 ? (en ? 'settlement' : 'селище') : (en ? 'village' : 'село');
  }

  function placesUrl() {
    const src = document.querySelector('script[src*="calculator.js"]')?.getAttribute('src') || '';
    const v = src.split('?v=')[1];
    return `/assets/data/places.json${v ? `?v=${v}` : ''}`;
  }

  function loadPlaces() {
    if (!places.loading) {
      places.failed = false;
      places.loading = fetch(placesUrl())
        .then((r) => {
          if (!r.ok) throw new Error(`places.json ${r.status}`);
          return r.json();
        })
        .then((doc) => {
          places.rows = doc.places.map((row) => ({ uk: row[0], en: row[1], region: doc.regions[row[2]], km: row[3], type: row[4], former: row[5] || '' }));
          places.keys = places.rows.map((p) => [norm(p.uk), norm(p.en), norm(p.former)]);
        })
        .catch(() => {
          places.loading = null;
          places.failed = true;
        })
        .finally(() => {
          renderHint();
          if (document.activeElement === placeInput && !selectedPlace) refreshResults();
        });
    }
    return places.loading;
  }

  function matchScore(key, q) {
    if (key === q) return 0;
    if (key.startsWith(q)) return 1;
    if (key.includes(` ${q}`)) return 2;
    if (key.includes(q)) return 3;
    return 4;
  }

  // Best matches first; then towns before villages; then the nearest to the warehouse
  function search(query) {
    const q = norm(query);
    if (q.length < 2 || !places.rows) return [];
    const hits = [];
    for (let i = 0; i < places.rows.length; i++) {
      const [ku, ke, kf] = places.keys[i];
      const score = Math.min(matchScore(ku, q), matchScore(ke, q), kf ? matchScore(kf, q) : 4);
      if (score < 4) hits.push([score, i]);
    }
    const P = places.rows;
    hits.sort((a, b) => a[0] - b[0] || P[b[1]].type - P[a[1]].type || P[a[1]].km - P[b[1]].km);
    return hits.slice(0, 8).map(([, i]) => P[i]);
  }

  function renderHint() {
    if (!placeHint) return;
    const en = lang() === 'en';
    if (selectedPlace) {
      placeHint.textContent = en
        ? `${regionLabel(selectedPlace.region)}, ${selectedPlace.km} km by road from our warehouse.`
        : `${regionLabel(selectedPlace.region)}, ${selectedPlace.km} км дорогою від складу.`;
    } else if (places.failed) {
      placeHint.textContent = en
        ? 'Could not load the list of places. Try again, or call us and we will price delivery.'
        : 'Не вдалося завантажити список. Спробуйте ще раз або зателефонуйте, і ми порахуємо доставку.';
    } else if (places.loading && !places.rows) {
      placeHint.textContent = en ? 'Loading the list of places…' : 'Завантажуємо список населених пунктів…';
    } else {
      placeHint.textContent = en
        ? 'Start typing a town or village and pick it from the list.'
        : 'Почніть вводити місто або село й оберіть його зі списку.';
    }
  }

  function setOpen(open) {
    if (!placeList || !placeInput) return;
    placeList.hidden = !open;
    placeInput.setAttribute('aria-expanded', String(open));
    if (!open) placeInput.removeAttribute('aria-activedescendant');
  }

  function renderList() {
    if (!placeList) return;
    placeList.textContent = '';
    const en = lang() === 'en';
    const q = norm(placeInput.value);
    results.forEach((p, i) => {
      const li = document.createElement('li');
      li.id = `calc-place-opt-${i}`;
      li.className = 'calc-combo-opt';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      const name = document.createElement('span');
      name.className = 'calc-combo-name';
      name.textContent = placeName(p);
      const km = document.createElement('span');
      km.className = 'calc-combo-km';
      km.textContent = en ? `${p.km} km` : `${p.km} км`;
      const meta = document.createElement('span');
      meta.className = 'calc-combo-meta';
      meta.textContent = `${typeWord(p.type)}, ${regionLabel(p.region)}${p.former ? (en ? ` (formerly ${p.former})` : ` (колишній ${p.former})`) : ''}`;
      li.append(name, km, meta);
      li.addEventListener('click', () => choose(p));
      placeList.appendChild(li);
    });
    if (!results.length && places.rows && q.length >= 2) {
      const li = document.createElement('li');
      li.className = 'calc-combo-empty';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-disabled', 'true');
      li.textContent = en
        ? 'Nothing found. Check the spelling or type the nearest town.'
        : 'Нічого не знайдено. Перевірте назву або введіть найближче місто.';
      placeList.appendChild(li);
    }
    setOpen(placeList.children.length > 0);
    if (active >= 0) {
      placeInput.setAttribute('aria-activedescendant', `calc-place-opt-${active}`);
      placeList.children[active]?.scrollIntoView({ block: 'nearest' });
    } else {
      placeInput.removeAttribute('aria-activedescendant');
    }
  }

  function refreshResults() {
    results = search(placeInput.value);
    active = results.length ? 0 : -1;
    renderList();
  }

  function choose(p) {
    selectedPlace = p;
    placeInput.value = placeName(p);
    results = [];
    active = -1;
    setOpen(false);
    renderHint();
    updateCalculations();
  }

  if (placeInput && placeList) {
    placeInput.addEventListener('focus', () => {
      loadPlaces();
      renderHint();
      if (!selectedPlace && placeInput.value) refreshResults();
      // On phones the keyboard would cover the suggestions: lift the field to just under the sticky header
      if (window.matchMedia('(max-width: 768px)').matches) {
        setTimeout(() => {
          const header = document.querySelector('.site-header');
          const top = placeInput.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 40;
          window.scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        }, 250);
      }
    });

    placeInput.addEventListener('input', () => {
      selectedPlace = null;
      loadPlaces();
      renderHint();
      refreshResults();
      updateCalculations();
    });

    placeInput.addEventListener('keydown', (e) => {
      const open = !placeList.hidden && results.length > 0;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!results.length) return;
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        active = open ? (active + step + results.length) % results.length : 0;
        renderList();
      } else if (e.key === 'Enter') {
        if (open && active >= 0) {
          e.preventDefault();
          choose(results[active]);
        }
      } else if (e.key === 'Escape') {
        if (!placeList.hidden) {
          e.preventDefault();
          setOpen(false);
        }
      }
    });

    // Leaving the field (Tab) closes the list; an exact name typed counts as choosing it
    placeInput.addEventListener('blur', () => {
      if (!selectedPlace && results.length && norm(placeName(results[0])) === norm(placeInput.value)) choose(results[0]);
      setOpen(false);
    });

    // Keep focus in the input while an option is clicked, so the list doesn't close under the pointer
    placeList.addEventListener('mousedown', (e) => e.preventDefault());

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.calc-combo')) setOpen(false);
    });
  }

  modeRadios.forEach((radio) => radio.addEventListener('change', () => {
    setOpen(false);
    updateCalculations();
  }));

  // Starting destination: from ?city= on the city pages, otherwise Dnipro
  (function initDestination() {
    const param = new URLSearchParams(window.location.search).get('city') || 'dnipro';
    const mode = param === 'nikopol_pickup' ? 'pickup' : param === 'poland' ? 'export' : 'delivery';
    const radio = document.querySelector(`input[name="calc-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    // Also fill a place for pickup/export, so switching to delivery starts somewhere sensible
    const key = Object.hasOwn(PRESETS, param) ? param : param === 'nikopol_pickup' ? 'nikopol_deliv' : param === 'other_ua' ? null : 'dnipro';
    if (key && presetKm[key] != null) {
      selectedPlace = toPlace(PRESETS[key], presetKm[key]);
      if (placeInput) placeInput.value = placeName(selectedPlace);
    }
    renderHint();
  })();

  tonsSlider.addEventListener('input', (e) => {
    tonsInput.value = e.target.value;
    updateCalculations();
  });

  tonsInput.addEventListener('change', () => {
    updateCalculations();
  });

  if (effSelect) {
    effSelect.addEventListener('change', () => {
      updateCalculations();
    });
  }

  if (productSelect) {
    productSelect.addEventListener('change', updateCalculations);
  }

  // Pre-fill quote modal when clicking calculate order
  if (calcOrderBtn) {
    calcOrderBtn.addEventListener('click', () => {
      const modal = document.getElementById('contact-dialog');
      const volumeInput = document.getElementById('modal-volume');
      const cityInput = document.getElementById('modal-city');
      const bagsNow = bagsFor(parseFloat(tonsInput.value) || 0);

      if (volumeInput) {
        const product = productSelect ? productSelect.options[productSelect.selectedIndex].text : '';
        volumeInput.value = `${tonsInput.value} т (~${bagsNow} ${plural(bagsNow, 'біг-бег', 'біг-беги', 'біг-бегів')} по ${KG_PER_BAG} кг)${product ? `, ${product}` : ''}`;
      }

      if (cityInput) {
        const mode = currentMode();
        const en = lang() === 'en';
        cityInput.value = mode === 'pickup' ? (en ? 'Pickup, Nikopol warehouse' : 'Самовивіз, склад у Нікополі')
          : mode === 'export' ? (en ? 'Export to Poland' : 'Експорт у Польщу')
          : selectedPlace ? `${placeName(selectedPlace)} (${regionLabel(selectedPlace.region)})`
          : (placeInput ? placeInput.value : '');
      }

      // Pickup or delivery carries over to the form (main.js shows the pickup vehicle question)
      // (and the tonnage, for its vehicle-capacity warning)
      const leadForm = modal?.querySelector('.quote-lead-form');
      if (leadForm) leadForm.dataset.tons = String(parseFloat(tonsInput.value) || '');
      const receive = modal?.querySelector(`input[name="receive"][value="${currentMode() === 'pickup' ? 'Самовивіз' : 'Доставка'}"]`);
      if (receive) {
        receive.checked = true;
        receive.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    });
  }

  // Re-render unit labels, the chosen place and the delivery notice when the language switches
  window.addEventListener('languageChanged', () => {
    if (selectedPlace && placeInput) placeInput.value = placeName(selectedPlace);
    renderHint();
    updateCalculations();
  });

  // Live diesel price (falls back to analytics-config.js if the file is missing or malformed)
  fetch('/data/fuel.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((f) => {
      if (f && f.diesel_uah_per_l > 0) {
        fuelFile = f;
        updateCalculations();
      }
    })
    .catch(() => {});

  // Initial calculation run
  updateCalculations();
});
