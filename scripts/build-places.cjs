#!/usr/bin/env node
/*
 * Builds assets/data/places.json: every settlement in government-controlled Ukraine with its road
 * distance from the Nikopol warehouse. The delivery calculator searches this list as the buyer types.
 *
 * Data:
 *   settlements, coordinates  ua-location (npm, ISC): Ukraine humanitarian reference data (OCHA COD, 2026-02)
 *   town / village type       ua-geo-set (npm, MIT): official KATOTTG register, 2024
 *   occupied communities      scripts/data/occupied-hromadas.json (RMCA list, 31.01.2024, >=50% occupied)
 *   road distances            OSRM on the OpenStreetMap map of Ukraine (© OpenStreetMap contributors, ODbL)
 *
 * Rebuild (a few times a year is plenty):
 *   npm i --no-save ua-location@1.1.3 ua-geo-set@1.0.4 @project-osrm/osrm@6.0.0   (OSRM needs libtbb12)
 *   node scripts/build-places.cjs mask /tmp/osrm/occupied_cells.lua
 *   # copy node_modules/@project-osrm/osrm/profiles/{car.lua,lib} to /tmp/osrm, add the occupied_cells
 *   # barrier to process_node (see DESIGN.md, "Delivery pricing"), then with a Ukraine .osm.pbf:
 *   osrm-extract -p car.lua ukraine.osm.pbf && osrm-partition ukraine.osrm && osrm-customize ukraine.osrm
 *   osrm-routed --algorithm mld --max-table-size 1000 ukraine.osrm &
 *   node scripts/build-places.cjs build http://127.0.0.1:5000
 */
const fs = require('fs');
const path = require('path');

const ORIGIN = { name: 'Нікополь, склад', lat: 47.58261, lon: 34.33747 }; // JSON-LD geo of the warehouse
const OUT = path.join(__dirname, '..', 'assets', 'data', 'places.json');
const OCCUPIED = require('./data/occupied-hromadas.json');
const CELL = 0.02; // degrees, ~2 km: resolution of the no-go mask used by the routing profile

const norm = (s) => String(s || '').toLowerCase().replace(/[’ʼ'`]/g, '').trim();
const apostrophe = (s) => String(s).replace(/['ʼ`]/g, '’'); // the source mixes ' and ’

// Official 2024 renames the source data predates (Verkhovna Rada, 2024). The former name stays searchable.
const RENAMES = {
  UA1210007001: ['Самар', 'Samar', 'Новомосковськ'],
  UA1214021001: ['Шахтарське', 'Shakhtarske', 'Першотравенськ'],
};
const RAION_RENAMES = { UA1210: ['Самарівський', 'Samarivskyi'] };

async function loadSettlements() {
  const { UaLocation } = require('ua-location');
  const all = await UaLocation.Settlement.getAll();
  const occupied = new Set(OCCUPIED.hromadas.map((h) => h[0]));
  const list = [];
  for (const s of all.values()) {
    // Settlement codes nest: UA + oblast(2) + raion(2) + hromada(3) + settlement(3). A few records
    // (Sevastopol) have no hromada object, so read the parents from the code itself.
    const hromada = s.iso.slice(0, 9);
    const r = UaLocation.Raion.findByIso(s.iso.slice(0, 6));
    if (!r) continue;
    list.push({ iso: s.iso, ua: s.ua, en: s.en, lat: s.loc[0], lon: s.loc[1], hromada, raion: r, oblast: r.oblast, occupied: occupied.has(hromada) || !s.hromada });
  }
  return list;
}

// Town (M), settlement (X/T) or village (C), from the KATOTTG register: matched on oblast + raion + name.
function loadTypes() {
  // The package doesn't export its data file, so read it next to the resolved entry point
  const k = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('ua-geo-set')), '..', 'data', 'kattog.json'), 'utf8'));
  const parent = new Map();
  k.items.forEach((x, i) => (x.c || []).forEach((c) => parent.set(c, i)));
  const up = (i, cat) => { let p = parent.get(i); while (p !== undefined && k.items[p].k !== cat) p = parent.get(p); return p === undefined ? null : k.items[p]; };
  const rank = { K: 2, M: 2, T: 1, X: 1, C: 0 }; // K: Kyiv, a city with special status
  const types = new Map();
  k.items.forEach((x, i) => {
    if (!(x.k in rank)) return;
    const o = up(i, 'O') || up(i, 'K'), r = up(i, 'P');
    const key = `${norm(o && o.n)}|${norm(r && r.n)}|${norm(x.n)}`;
    types.set(key, Math.max(types.get(key) ?? 0, rank[x.k]));
  });
  return types;
}

// Lua table of grid cells whose nearest settlement is in an occupied community.
async function writeMask(file) {
  const pts = await loadSettlements();
  const B = 0.1, buckets = new Map();
  for (const p of pts) {
    const key = `${Math.floor(p.lat / B)}:${Math.floor(p.lon / B)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }
  const cells = [];
  for (let i = Math.floor(44 / CELL); i < Math.ceil(52.5 / CELL); i++) {
    for (let j = Math.floor(22 / CELL); j < Math.ceil(40.3 / CELL); j++) {
      const la = (i + 0.5) * CELL, lo = (j + 0.5) * CELL, c = Math.cos(la * Math.PI / 180);
      let best = null, bd = Infinity;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        for (const p of buckets.get(`${Math.floor(la / B) + di}:${Math.floor(lo / B) + dj}`) || []) {
          const d = (p.lat - la) ** 2 + ((p.lon - lo) * c) ** 2;
          if (d < bd) { bd = d; best = p; }
        }
      }
      if (best && best.occupied) cells.push(`["${i}:${j}"]=true`);
    }
  }
  fs.writeFileSync(file, `-- ${CELL}-degree cells nearest to settlements in occupied communities (${OCCUPIED.as_of}). Generated by scripts/build-places.cjs.\nreturn {\n${cells.join(',\n')}\n}\n`);
  console.log(`${cells.length} occupied cells -> ${file}`);
}

async function build(osrm) {
  const [settlements, types] = [await loadSettlements(), loadTypes()];
  const places = settlements.filter((p) => !p.occupied);
  console.log(`${settlements.length} settlements, ${places.length} outside occupied communities`);

  // Road distance from the warehouse, 500 destinations per OSRM table request
  const km = new Map();
  for (let i = 0; i < places.length; i += 500) {
    const batch = places.slice(i, i + 500);
    const coords = [ORIGIN, ...batch].map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const res = await fetch(`${osrm}/table/v1/driving/${coords}?sources=0&annotations=distance`);
    const data = await res.json();
    if (data.code !== 'Ok') throw new Error(`OSRM: ${data.code} ${data.message || ''}`);
    // Skip places whose nearest usable road is >10 km away (islands, or roads cut off by the occupied zone)
    data.distances[0].slice(1).forEach((m, k) => {
      if (m != null && data.destinations[k + 1].distance <= 10000) km.set(batch[k].iso, Math.round(m / 1000));
    });
  }

  const regions = [], regionIndex = new Map();
  const out = [];
  let unreachable = 0, typed = 0;
  for (const p of places) {
    if (!km.has(p.iso)) { unreachable++; continue; }
    const rKey = p.raion.iso;
    if (!regionIndex.has(rKey)) {
      regionIndex.set(rKey, regions.length);
      const [rUa, rEn] = RAION_RENAMES[rKey] || [p.raion.ua, p.raion.en];
      regions.push([apostrophe(rUa), apostrophe(p.oblast.ua), rEn, p.oblast.en]);
    }
    const t = types.get(`${norm(p.oblast.ua)}|${norm(p.raion.ua)}|${norm(p.ua)}`)
      ?? (p.iso === 'UA8000000000' ? 2 : undefined);
    if (t !== undefined) typed++;
    const [ua, en, former] = RENAMES[p.iso] || [p.ua, p.en];
    const row = [apostrophe(ua), en, regionIndex.get(rKey), km.get(p.iso), t ?? 0];
    if (former) row.push(former);
    out.push(row);
  }
  out.sort((a, b) => a[3] - b[3]);

  const doc = {
    version: new Date().toISOString().slice(0, 10),
    origin: ORIGIN,
    columns: ['name_uk', 'name_en', 'region', 'road_km', 'type: 2 town, 1 settlement, 0 village', 'former name (optional)'],
    regions_columns: ['raion_uk', 'oblast_uk', 'raion_en', 'oblast_en'],
    attribution: 'Road distances © OpenStreetMap contributors (ODbL), routed with OSRM. Settlements: Ukraine humanitarian reference data (OCHA COD). Occupied communities as of ' + OCCUPIED.as_of + ' are excluded.',
    regions,
    places: out,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc));
  console.log(`${out.length} places written (${unreachable} unreachable or >10 km from a usable road, skipped, ${typed} typed) -> ${OUT}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}

const [cmd, arg] = process.argv.slice(2);
(cmd === 'mask' ? writeMask(arg || 'occupied_cells.lua') : cmd === 'build' ? build(arg || 'http://127.0.0.1:5000') : Promise.reject(new Error('usage: build-places.cjs mask <file> | build <osrm-url>')))
  .catch((e) => { console.error(e.message); process.exit(1); });
