/**
 * Place search shared by the delivery calculator and the quote form.
 * places.json (built by scripts/build-places.cjs): every settlement in government-controlled Ukraine
 * with its road distance from the warehouse. It is fetched when the buyer starts typing.
 */
(function () {
  const state = { rows: null, keys: null, loading: null, failed: false };

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

  function placeName(p, lang) {
    return lang === 'en' ? p.en : p.uk;
  }

  function regionLabel(r, lang) {
    if (lang === 'en') return r[2] === r[3] ? r[3] : `${r[2]} district, ${r[3]} Oblast`;
    return r[0] === r[1] ? `м. ${r[1]}` : `${r[0]} р-н, ${r[1]} обл.`;
  }

  function typeWord(type, lang) {
    const en = lang === 'en';
    return type === 2 ? (en ? 'town' : 'місто') : type === 1 ? (en ? 'settlement' : 'селище') : (en ? 'village' : 'село');
  }

  function placesUrl() {
    const src = document.querySelector('script[src*="places.js"]')?.getAttribute('src') || '';
    const v = src.split('?v=')[1];
    return `/assets/data/places.json${v ? `?v=${v}` : ''}`;
  }

  // Resolves once the list has loaded or failed (state.failed); a failed load is retried on the next call
  function load() {
    if (!state.loading) {
      state.failed = false;
      state.loading = fetch(placesUrl())
        .then((r) => {
          if (!r.ok) throw new Error(`places.json ${r.status}`);
          return r.json();
        })
        .then((doc) => {
          state.rows = doc.places.map((row) => ({ uk: row[0], en: row[1], region: doc.regions[row[2]], km: row[3], type: row[4], former: row[5] || '' }));
          state.keys = state.rows.map((p) => [norm(p.uk), norm(p.en), norm(p.former)]);
        })
        .catch(() => {
          state.loading = null;
          state.failed = true;
        });
    }
    return state.loading;
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
    if (q.length < 2 || !state.rows) return [];
    const hits = [];
    for (let i = 0; i < state.rows.length; i++) {
      const [ku, ke, kf] = state.keys[i];
      const score = Math.min(matchScore(ku, q), matchScore(ke, q), kf ? matchScore(kf, q) : 4);
      if (score < 4) hits.push([score, i]);
    }
    const P = state.rows;
    hits.sort((a, b) => a[0] - b[0] || P[b[1]].type - P[a[1]].type || P[a[1]].km - P[b[1]].km);
    return hits.slice(0, 8).map(([, i]) => P[i]);
  }

  /**
   * Type-to-search list on a text input (ARIA combobox). Options:
   *   lang()        'uk' | 'en'
   *   isChosen()    true while the input holds a place picked from the list
   *   onChoose(p)   a place was picked; the input already shows its name
   *   onEdit()      the buyer changed the text, so any earlier pick no longer applies
   *   onLoad()      places.json finished loading (or failed)
   *   enabled()     false turns the suggestions off (the quote form's "outside Ukraine")
   *   emptyText(en) shown when nothing matches
   */
  function combobox(input, list, opts) {
    const lang = opts.lang;
    const enabled = opts.enabled || (() => true);
    let results = [];
    let active = -1;

    function setOpen(open) {
      list.hidden = !open;
      input.setAttribute('aria-expanded', String(open));
      if (!open) input.removeAttribute('aria-activedescendant');
    }

    function renderList() {
      list.textContent = '';
      const en = lang() === 'en';
      const q = norm(input.value);
      results.forEach((p, i) => {
        const li = document.createElement('li');
        li.id = `${list.id}-opt-${i}`;
        li.className = 'calc-combo-opt';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === active));
        const name = document.createElement('span');
        name.className = 'calc-combo-name';
        name.textContent = placeName(p, lang());
        const km = document.createElement('span');
        km.className = 'calc-combo-km';
        km.textContent = en ? `${p.km} km` : `${p.km} км`;
        const meta = document.createElement('span');
        meta.className = 'calc-combo-meta';
        meta.textContent = `${typeWord(p.type, lang())}, ${regionLabel(p.region, lang())}${p.former ? (en ? ` (formerly ${p.former})` : ` (колишній ${p.former})`) : ''}`;
        li.append(name, km, meta);
        li.addEventListener('click', () => choose(p));
        list.appendChild(li);
      });
      if (!results.length && state.rows && q.length >= 2) {
        const li = document.createElement('li');
        li.className = 'calc-combo-empty';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-disabled', 'true');
        li.textContent = opts.emptyText ? opts.emptyText(en) : en
          ? 'Nothing found. Check the spelling or type the nearest town.'
          : 'Нічого не знайдено. Перевірте назву або введіть найближче місто.';
        list.appendChild(li);
      }
      setOpen(list.children.length > 0);
      if (active >= 0) {
        input.setAttribute('aria-activedescendant', `${list.id}-opt-${active}`);
        list.children[active]?.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function refresh() {
      results = enabled() ? search(input.value) : [];
      active = results.length ? 0 : -1;
      renderList();
    }

    function choose(p) {
      input.value = placeName(p, lang());
      results = [];
      active = -1;
      setOpen(false);
      opts.onChoose(p);
    }

    function startLoad() {
      if (state.rows || !enabled()) return;
      load().then(() => {
        if (opts.onLoad) opts.onLoad();
        if (document.activeElement === input && !opts.isChosen()) refresh();
      });
    }

    input.addEventListener('focus', () => {
      startLoad();
      if (!opts.isChosen() && input.value) refresh();
    });

    input.addEventListener('input', () => {
      startLoad();
      opts.onEdit();
      refresh();
    });

    input.addEventListener('keydown', (e) => {
      const open = !list.hidden && results.length > 0;
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
        if (!list.hidden) {
          e.preventDefault();
          e.stopPropagation(); // in the quote dialog, Escape closes the list, not the dialog
          setOpen(false);
        }
      }
    });

    // Leaving the field (Tab) closes the list; an exact name typed counts as choosing it
    input.addEventListener('blur', () => {
      if (!opts.isChosen() && results.length && norm(placeName(results[0], lang())) === norm(input.value)) choose(results[0]);
      setOpen(false);
    });

    // Keep focus in the input while an option is clicked, so the list doesn't close under the pointer
    list.addEventListener('mousedown', (e) => e.preventDefault());

    const box = input.closest('.calc-combo');
    document.addEventListener('pointerdown', (e) => {
      if (!box || !box.contains(e.target)) setOpen(false);
    });

    return { close: () => setOpen(false), refresh, choose };
  }

  window.Places = { state, norm, placeName, regionLabel, typeWord, load, search, combobox };
})();
