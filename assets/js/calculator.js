/**
 * UkrEcoPelleta & ТОВ «УКРЕКОПЕЛЕТА» — Interactive Pellet Volume & Regional Logistics Calculator
 */

document.addEventListener('DOMContentLoaded', () => {
  const tonsSlider = document.getElementById('calc-tons-slider');
  const tonsInput = document.getElementById('calc-tons-input');
  const citySelect = document.getElementById('calc-city-select');

  const resTons = document.getElementById('res-total-tons');
  const resBags = document.getElementById('res-big-bags');
  const resEnergy = document.getElementById('res-energy-val');
  const resHeatOutput = document.getElementById('res-heat-output');
  const minOrderAlert = document.getElementById('min-order-alert');
  const calcOrderBtn = document.getElementById('calc-order-btn');
  const effSelect = document.getElementById('calc-eff-select');

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

  // Load plan: one row per truck (22–24 t curtain-siders carry 24 big-bags of ~975 kg).
  const BAGS_PER_TRUCK = 24;
  const MAX_ROWS = 5;
  const MIN_DELIVERY_BAGS = 15;
  const loadPlan = document.getElementById('load-plan');
  const loadRows = document.getElementById('load-plan-rows');
  const loadSummary = document.getElementById('load-plan-summary');
  let filledBefore = 0;

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

    // Big Bags: each holds ~950–1000 kg of pellets, use midpoint ~975 kg/bag
    const KG_PER_BAG = 975; // midpoint of 950–1000 kg range
    const bigBags = Math.round(tons * 1000 / KG_PER_BAG);

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

    // Check regional delivery constraints
    // Minimum order: strictly at least 15 tonnes (from 15 big-bags)
    const selectedCity = citySelect ? citySelect.value : 'dnipro';
    const isNikopolPickup = selectedCity === 'nikopol_pickup';
    const meetsMinOrder = tons >= 15;

    renderLoadPlan(bigBags, isNikopolPickup);

    if (minOrderAlert) {
      const key = isNikopolPickup ? 'calc.min_alert_pickup' : meetsMinOrder ? 'calc.min_alert_ok' : 'calc.min_alert_warn';
      minOrderAlert.className = `min-order-indicator ${meetsMinOrder || isNikopolPickup ? 'min-order-ok' : 'min-order-warn'}`;
      minOrderAlert.textContent = t(key);
    }
  }

  tonsSlider.addEventListener('input', (e) => {
    tonsInput.value = e.target.value;
    updateCalculations();
  });

  tonsInput.addEventListener('change', () => {
    updateCalculations();
  });

  if (citySelect) {
    citySelect.addEventListener('change', () => {
      updateCalculations();
    });
  }

  if (effSelect) {
    effSelect.addEventListener('change', () => {
      updateCalculations();
    });
  }

  // Pre-fill quote modal when clicking calculate order
  if (calcOrderBtn) {
    calcOrderBtn.addEventListener('click', () => {
      const modal = document.getElementById('contact-dialog');
      const volumeInput = document.getElementById('modal-volume');
      const cityInput = document.getElementById('modal-city');
      const bagsNow = Math.round((parseFloat(tonsInput.value) || 0) * 1000 / 975);

      if (volumeInput) {
        volumeInput.value = `${tonsInput.value} т (~${bagsNow} біг-бегів по 950–1000 кг)`;
      }

      if (cityInput && citySelect) {
        const selectedText = citySelect.options[citySelect.selectedIndex].text;
        cityInput.value = selectedText;
      }

      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    });
  }

  // Re-render unit labels and the delivery notice when the language switches
  window.addEventListener('languageChanged', updateCalculations);

  // Initial calculation run
  updateCalculations();
});
