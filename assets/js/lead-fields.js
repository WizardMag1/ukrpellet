/**
 * Quote form: the phone and delivery place fields (markup: scripts/sync-layout.cjs, buildContactFields).
 *
 * Phone: the country's flag shows as soon as a number is typed with "+" or "00"; a number without either is
 * Ukrainian. Leaving the field corrects it (099… → +380 99 123 45 67). A number that can't exist is refused
 * with the reason. The rules are assets/js/phone.js, which /api/lead runs again on the server.
 *
 * Place: picked from the settlement list (assets/js/places.js, the calculator's search), a pin on the map,
 * or "outside Ukraine" with the town written in. A pin is sent as coordinates the sales team opens in
 * Google Maps. The map (Leaflet + OpenStreetMap, free, no key) loads only when the buyer opens it.
 *
 * main.js reads the answers with LeadFields.payload(form) when sending.
 */
(function () {
  const siteLang = () => { try { return localStorage.getItem('site_lang') || 'uk'; } catch (e) { return 'uk'; } };
  const LEAFLET = {
    js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    jsSri: 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
    cssSri: 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==',
  };
  // OpenStreetMap's geocoder: finds the typed town on the map and names the place a pin was dropped on.
  // Its policy allows occasional requests from a page like this one (one per action, never per keystroke).
  const NOMINATIM = 'https://nominatim.openstreetmap.org';
  const UKRAINE_VIEW = [[48.4, 31.2], 6];
  const fields = new WeakMap();
  let leafletLoading = null;

  // ---- Phone ---------------------------------------------------------------------------------------
  function setupPhone(form) {
    const input = form.querySelector('input[name="phone"]');
    const flag = form.querySelector('.phone-flag');
    const hint = form.querySelector('[data-phone-hint]');
    if (!input) return null;
    let touched = false;
    let entered = ''; // what the buyer typed before the form corrected it, for the sales team

    function setHint(text, isError, fix) {
      if (!hint) return;
      hint.textContent = text;
      hint.classList.toggle('is-error', !!isError);
      if (fix) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'field-fix';
        btn.textContent = fix.label;
        btn.addEventListener('click', () => {
          input.value = fix.value;
          render(true);
          input.focus();
        });
        hint.append(' ', btn);
      }
    }

    function render(final) {
      const P = window.LeadPhone;
      if (!P) return; // a browser without module scripts: /api/lead still checks the number
      const en = siteLang() === 'en';
      const r = P.parsePhone(input.value);
      if (final && r.valid && input.value !== r.display) {
        if (r.corrected) entered = input.value.trim();
        input.value = r.display;
      }

      // The flag shows once the number carries its country code ("+" or "00"), as typed or as corrected
      const iso = r.iso && /^\s*(\+|00[1-9])/.test(input.value) ? r.iso : null;
      if (flag) {
        if (iso) {
          flag.src = `/assets/images/flags/${iso.toLowerCase()}.svg`;
          flag.hidden = false;
        } else {
          flag.hidden = true;
          flag.removeAttribute('src');
        }
      }
      input.classList.toggle('has-flag', !!iso);

      input.setCustomValidity(r.valid ? '' : P.phoneMessage(r, siteLang()));
      if (r.valid) {
        setHint(`${P.countryName(r.iso, siteLang()) || (en ? 'International number' : 'Міжнародний номер')} · ${r.display}`);
      } else if (touched && r.reason !== 'empty') {
        const fix = r.reason === 'needPlus' && r.suggestion
          ? { label: en ? `Yes, ${r.suggestion.display}` : `Так, ${r.suggestion.display}`, value: r.suggestion.display }
          : null;
        setHint(P.phoneMessage(r, siteLang()), true, fix);
      } else if (touched) {
        setHint(P.phoneMessage(r, siteLang()), true);
      } else {
        setHint(iso ? P.countryName(iso, siteLang()) : '');
      }
    }

    input.addEventListener('input', () => {
      entered = '';
      render(false);
    });
    input.addEventListener('blur', () => {
      if (input.value.trim()) touched = true;
      render(true);
    });
    // A pasted number is corrected at once
    input.addEventListener('paste', () => setTimeout(() => render(true), 0));
    // Sending was blocked by this field: explain why
    input.addEventListener('invalid', () => {
      touched = true;
      render(false);
    });
    form.addEventListener('reset', () => setTimeout(() => {
      touched = false;
      entered = '';
      render(false);
    }, 0));
    window.addEventListener('languageChanged', () => render(false));
    render(false);

    return {
      value() {
        const r = window.LeadPhone ? window.LeadPhone.parsePhone(input.value) : null;
        if (!r || !r.valid) return { phone: input.value.trim() };
        return { phone: r.display, phone_entered: entered && entered !== r.display ? entered : '' };
      },
      // /api/lead refused the number (only possible when this check could not run)
      rejected() {
        touched = true;
        render(false);
        input.reportValidity();
        input.focus();
      },
    };
  }

  // ---- Delivery place --------------------------------------------------------------------------------
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (!leafletLoading) {
      leafletLoading = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET.css;
        css.integrity = LEAFLET.cssSri;
        css.crossOrigin = 'anonymous';
        document.head.appendChild(css);
        const js = document.createElement('script');
        js.src = LEAFLET.js;
        js.integrity = LEAFLET.jsSri;
        js.crossOrigin = 'anonymous';
        js.onload = resolve;
        js.onerror = () => {
          leafletLoading = null;
          reject(new Error('leaflet'));
        };
        document.head.appendChild(js);
      });
    }
    return leafletLoading;
  }

  function setupPlace(form) {
    const P = window.Places;
    const input = form.querySelector('input[name="city"]');
    const list = form.querySelector('.lead-place .calc-combo-list');
    if (!input || !list || !P) return null;
    const hint = form.querySelector('[data-place-hint]');
    const abroadBox = form.querySelector('[data-abroad]');
    const mapBtn = form.querySelector('[data-map-toggle]');
    const mapBox = form.querySelector('.lead-map');
    const canvas = form.querySelector('.lead-map-canvas');
    const mapHint = form.querySelector('[data-map-hint]');

    let selected = null; // a place from the list
    let pin = null;      // { lat, lon } from the map
    let touched = false;
    let map = null;
    let marker = null;

    const en = () => siteLang() === 'en';
    const pickup = () => form.querySelector('input[name="receive"]:checked')?.value === 'Самовивіз';
    const abroad = () => !!abroadBox?.checked && !pickup();

    const combo = P.combobox(input, list, {
      lang: siteLang,
      isChosen: () => !!selected,
      enabled: () => !abroad(),
      onChoose(p) {
        selected = p;
        update();
      },
      onEdit() {
        selected = null;
        update();
      },
      onLoad: () => update(),
      emptyText: (isEn) => (isEn
        ? 'Not found in Ukraine. Check the spelling, put a pin on the map, or tick "I am outside Ukraine".'
        : 'В Україні не знайдено. Перевірте назву, поставте мітку на карті або позначте «Я за межами України».'),
    });

    function problem() {
      if (pickup()) return '';
      if (!input.value.trim()) return en() ? 'Enter where to deliver.' : 'Вкажіть, куди доставити.';
      if (selected || pin || abroad()) return '';
      return en()
        ? 'Pick the place from the list, put a pin on the map, or tick "I am outside Ukraine".'
        : 'Оберіть населений пункт зі списку, поставте мітку на карті або позначте «Я за межами України».';
    }

    function update() {
      const msg = problem();
      input.setCustomValidity(msg);
      if (!hint) return;
      let text = '';
      let isError = false;
      if (pickup()) {
        text = '';
      } else if (selected) {
        text = en()
          ? `${P.regionLabel(selected.region, 'en')}, ${selected.km} km by road from our warehouse.`
          : `${P.regionLabel(selected.region, 'uk')}, ${selected.km} км дорогою від складу.`;
      } else if (abroad()) {
        text = en()
          ? 'Write the town and country, e.g. Iecava, Latvia. Our manager prices delivery abroad.'
          : 'Напишіть місто й країну, напр. Iecava, Латвія. Доставку за кордон рахує менеджер.';
      } else if (pin && input.value.trim()) {
        text = en() ? 'The pin is on the map: our manager will see the exact spot.' : 'Мітку поставлено: менеджер побачить точне місце доставки.';
      } else if (touched && msg) {
        text = msg;
        isError = true;
      } else if (P.state.failed) {
        text = en()
          ? 'Could not load the list of places. Write the name and put a pin on the map.'
          : 'Не вдалося завантажити список. Напишіть назву й поставте мітку на карті.';
      } else if (P.state.loading && !P.state.rows) {
        text = en() ? 'Loading the list of places…' : 'Завантажуємо список населених пунктів…';
      } else {
        text = en()
          ? 'Start typing a town or village and pick it from the list.'
          : 'Почніть вводити місто або село й оберіть його зі списку.';
      }
      hint.textContent = text;
      hint.classList.toggle('is-error', isError);
    }

    function setMapHint() {
      if (canvas) canvas.setAttribute('aria-label', en() ? 'Map for the delivery pin' : 'Карта для мітки доставки');
      if (!mapHint) return;
      mapHint.textContent = '';
      if (!pin) {
        mapHint.textContent = en()
          ? 'Tap the map where the pellets should arrive. You can drag the pin.'
          : 'Натисніть на карті там, куди привезти пелети. Мітку можна перетягнути.';
        return;
      }
      mapHint.textContent = en() ? `Pin: ${pin.lat}, ${pin.lon}. ` : `Мітка: ${pin.lat}, ${pin.lon}. `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'field-fix';
      btn.textContent = en() ? 'Remove pin' : 'Прибрати мітку';
      btn.addEventListener('click', clearPin);
      mapHint.appendChild(btn);
    }

    function clearPin() {
      pin = null;
      if (marker) {
        marker.remove();
        marker = null;
      }
      setMapHint();
      update();
    }

    // Names the spot a pin was dropped on: fills an empty field, and ticks "outside Ukraine" for a pin abroad
    function nameThePin(at) {
      const lang = en() ? 'en' : 'uk';
      fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=12&accept-language=${lang}&lat=${at.lat}&lon=${at.lon}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || pin !== at || selected) return;
          const a = d.address || {};
          const local = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || '';
          const country = (a.country_code || '').toUpperCase();
          if (country && country !== 'UA') {
            if (abroadBox) abroadBox.checked = true;
            combo.close();
            if (!input.value.trim()) input.value = [local, a.country].filter(Boolean).join(', ');
          } else if (local && !input.value.trim()) {
            input.value = local;
            P.load().then(() => {
              const top = P.search(local)[0];
              if (top && pin === at && !selected && P.norm(P.placeName(top, lang)) === P.norm(local)) combo.choose(top);
            });
          }
          update();
        })
        .catch(() => {});
    }

    function setPin(lat, lon) {
      pin = { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
      if (marker) {
        marker.setLatLng([pin.lat, pin.lon]);
      } else {
        marker = window.L.marker([pin.lat, pin.lon], { draggable: true, keyboard: true }).addTo(map);
        marker.on('dragend', () => {
          const ll = marker.getLatLng();
          setPin(ll.lat, ll.lng);
        });
      }
      setMapHint();
      update();
      nameThePin(pin);
    }

    // Shows the typed or picked place on the map
    function centerOnPlace() {
      const q = selected
        ? `${selected.uk}, ${selected.region[0] === selected.region[1] ? '' : `${selected.region[0]} район, `}${selected.region[1]} область, Україна`
        : input.value.trim();
      if (!q) return;
      fetch(`${NOMINATIM}/search?format=jsonv2&limit=1&accept-language=uk&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((hits) => {
          if (hits && hits[0] && map && !pin) map.setView([Number(hits[0].lat), Number(hits[0].lon)], 13);
        })
        .catch(() => {});
    }

    function openMap() {
      if (mapHint) mapHint.textContent = en() ? 'Loading the map…' : 'Завантажуємо карту…';
      loadLeaflet().then(() => {
        if (mapBox.hidden) return;
        const L = window.L;
        if (!map) {
          map = L.map(canvas, { scrollWheelZoom: false }).setView(...UKRAINE_VIEW);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
          }).addTo(map);
          map.on('click', (e) => setPin(e.latlng.lat, e.latlng.lng));
        }
        map.invalidateSize(); // the box was hidden when the map was made
        if (pin) map.setView([pin.lat, pin.lon], 14);
        else centerOnPlace();
        setMapHint();
      }).catch(() => {
        if (mapHint) {
          mapHint.textContent = en()
            ? 'The map did not load. Pick the place from the list, or describe the address in the comment.'
            : 'Карта не завантажилась. Оберіть місце зі списку або опишіть адресу в коментарі.';
        }
      });
    }

    if (mapBtn && mapBox && canvas) {
      mapBtn.addEventListener('click', () => {
        const open = mapBox.hidden;
        mapBox.hidden = !open;
        mapBtn.setAttribute('aria-expanded', String(open));
        if (open) openMap();
      });
    }

    if (abroadBox) {
      abroadBox.addEventListener('change', () => {
        selected = null;
        combo.close();
        update();
        if (!abroadBox.checked) combo.refresh();
      });
    }

    input.addEventListener('blur', () => {
      if (input.value.trim()) touched = true;
      update();
    });
    input.addEventListener('invalid', () => {
      touched = true;
      update();
    });
    // Delivery or pickup switched
    form.addEventListener('change', (e) => {
      if (e.target.name === 'receive') update();
    });

    // The calculator's "order" button hands over the place it priced
    input.addEventListener('lead:place', (e) => {
      const d = e.detail || {};
      selected = null;
      if (abroadBox) abroadBox.checked = !!d.abroad;
      if (d.place) {
        combo.choose(d.place);
      } else {
        input.value = d.text || '';
        update();
      }
    });

    form.addEventListener('reset', () => setTimeout(() => {
      selected = null;
      touched = false;
      if (mapBox) mapBox.hidden = true;
      if (mapBtn) mapBtn.setAttribute('aria-expanded', 'false');
      clearPin();
    }, 0));

    window.addEventListener('languageChanged', () => {
      if (selected) input.value = P.placeName(selected, siteLang());
      update();
      if (map && !mapBox.hidden) setMapHint();
    });
    update();

    return {
      // In Ukrainian for the sales team, whatever the site language
      value() {
        const text = input.value.trim();
        if (pickup()) return { city: text };
        const geo = pin ? `${pin.lat},${pin.lon}` : '';
        if (selected) return { city: `${selected.uk} (${P.regionLabel(selected.region, 'uk')}), ${selected.km} км від складу`, geo };
        if (abroad()) return { city: `${text} (за межами України)`, geo };
        return { city: text, geo };
      },
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.quote-lead-form').forEach((form) => {
      fields.set(form, { phone: setupPhone(form), place: setupPlace(form) });
    });
  });

  window.LeadFields = {
    payload(form) {
      const f = fields.get(form) || {};
      return { ...(f.phone ? f.phone.value() : {}), ...(f.place ? f.place.value() : {}) };
    },
    phoneRejected(form) {
      fields.get(form)?.phone?.rejected();
    },
  };
})();
