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

  function updateCalculations() {
    let tons = parseFloat(tonsInput.value) || 15;
    if (tons < 1) tons = 1;
    if (tons > 500) tons = 500;

    tonsSlider.value = tons;
    tonsInput.value = tons;

    // Big Bags: each holds ~950–1000 kg of pellets, use midpoint ~975 kg/bag
    const KG_PER_BAG = 975; // midpoint of 950–1000 kg range
    const bigBags = Math.round(tons * 1000 / KG_PER_BAG);

    // Thermal energy (approx 4.9 kWh/kg => ~4.95 MWh / ton => ~4.25 Gcal / ton)
    const eff = currentEff();
    const grossMwh = tons * 4.95;
    const grossGcal = tons * 4.25;
    const mwh = (grossMwh).toFixed(1);
    const gcal = (grossGcal).toFixed(1);
    const usableMwh = (grossMwh * eff).toFixed(1);
    const usableGcal = (grossGcal * eff).toFixed(1);

    const en = lang() === 'en';
    const u = en
      ? { t: 't', pcs: 'pcs', mwh: 'MWh', gcal: 'Gcal' }
      : { t: 'т', pcs: 'шт', mwh: 'МВт·год', gcal: 'Гкал' };

    if (resTons) resTons.textContent = `${tons} ${u.t}`;
    if (resBags) resBags.textContent = `${bigBags} ${u.pcs}`;
    if (resEnergy) resEnergy.textContent = `~${mwh} ${u.mwh} (${gcal} ${u.gcal})`;
    if (resHeatOutput) resHeatOutput.textContent = `~${usableMwh} ${u.mwh} (${usableGcal} ${u.gcal})`;

    // Check regional delivery constraints
    // Minimum order: strictly at least 15 tonnes (from 15 big-bags)
    const selectedCity = citySelect ? citySelect.value : 'dnipro';
    const isNikopolPickup = selectedCity === 'nikopol_pickup';
    const meetsMinOrder = tons >= 15;

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
