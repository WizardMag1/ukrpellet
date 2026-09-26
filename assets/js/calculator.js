/**
 * IA-TEMS & UkrPellet — Interactive Pellet Volume & Regional Logistics Calculator
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

    if (resTons) resTons.textContent = `${tons} т / tons`;
    if (resBags) resBags.textContent = `${bigBags} шт / pcs`;
    if (resEnergy) resEnergy.textContent = `~${mwh} МВт·год (${gcal} Гкал)`;
    if (resHeatOutput) {
      const effKey = effSelect ? effSelect.value : 'e2';
      resHeatOutput.textContent = `E${effKey.toUpperCase().slice(1)} → ~${usableMwh} МВт·год (${usableGcal} Гкал) корисного тепла`;
    }

    // Check regional delivery constraints
    // Minimum order: 15 big-bags × ~975 kg ≈ 14.6 tonnes. Threshold ≈ 14.5 т.
    const selectedCity = citySelect ? citySelect.value : 'dnipro';
    const isNikopolPickup = selectedCity === 'nikopol_pickup';
    const meetsMinOrder = bigBags >= 15;

    if (minOrderAlert) {
      if (isNikopolPickup) {
        minOrderAlert.className = 'min-order-indicator min-order-ok';
        minOrderAlert.innerHTML = `<span>✔ Самовивіз у м. Нікополь: можливе відвантаження від 1 біг-бега за попереднім узгодженням.</span>`;
      } else if (meetsMinOrder) {
        minOrderAlert.className = 'min-order-indicator min-order-ok';
        minOrderAlert.innerHTML = `<span data-i18n="calc.min_alert_ok">✔ Об'єм відповідає умовам регіональної доставки (від 15 біг-бегів ≈ 14–15 т).</span>`;
      } else {
        minOrderAlert.className = 'min-order-indicator min-order-warn';
        minOrderAlert.innerHTML = `<span data-i18n="calc.min_alert_warn">⚠ Увага: для доставки по області мінімальна партія становить 15 біг-бегів (≈ 14–15 т). Для менших обсягів доступний самовивіз у м. Нікополь або індивідуальне узгодження.</span>`;
      }
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

  // Initial calculation run
  updateCalculations();
});
