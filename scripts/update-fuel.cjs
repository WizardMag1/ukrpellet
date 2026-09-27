#!/usr/bin/env node
/*
 * Keeps data/fuel.json (the diesel price the delivery calculator uses) in step with the market.
 * Runs daily from .github/workflows/fuel-price.yml.
 *
 * Source: index.minfin.com.ua/markets/fuel/, average price of diesel (ДП) at Ukrainian filling stations.
 *
 * Rule (set by the owner):
 *   - market price goes UP   -> the calculator uses it the same day;
 *   - market price goes DOWN -> nothing changes for a week. Only when the market has stayed below our
 *     price for 7 days in a row do we lower it, and then to the highest price seen during that week,
 *     so a short dip never makes a quote too low.
 *
 * Usage: node scripts/update-fuel.cjs            fetch, apply the rule, write data/fuel.json
 *        node scripts/update-fuel.cjs --dry-run  print the result, write nothing
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'fuel.json');
const SOURCE_URL = 'https://index.minfin.com.ua/markets/fuel/';
const DECREASE_DELAY_DAYS = 7;
const REFRESH_CHECKED_DAYS = 7;   // re-stamp "checked" at least weekly even when nothing moved
const MAX_DAILY_JUMP = 0.25;      // a >25% move is more likely a parsing error than the market
const MAX_SOURCE_AGE_DAYS = 5;    // ignore a source that stopped updating

const round2 = (n) => Math.round(n * 100) / 100;
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// Pull "Дизельное/Дизельне паливо ... 98,42" and the "на 25.09.2026" date out of Minfin's page.
function parseMinfin(html) {
  const row = html.match(/href=['"][^'"]*\/markets\/fuel\/dt\/['"][^>]*>[^<]*<\/a>[\s\S]*?<big>\s*([\d\s]+[.,]\d+)\s*<\/big>/i);
  if (!row) throw new Error('diesel row not found on the page');
  const price = parseFloat(row[1].replace(/\s/g, '').replace(',', '.'));
  const caption = html.match(/<caption>[^<]*?(\d{2})\.(\d{2})\.(\d{4})/i);
  if (!caption) throw new Error('price date not found on the page');
  const date = `${caption[3]}-${caption[2]}-${caption[1]}`;
  if (!(price >= 40 && price <= 250)) throw new Error(`implausible diesel price ${price}`);
  return { price: round2(price), date };
}

// Apply the owner's rule to one observation. Pure: returns the new state and what happened.
function nextState(state, obs, today) {
  const s = JSON.parse(JSON.stringify(state));
  const current = s.diesel_uah_per_l;
  let event = 'unchanged';

  if (obs.price > current) {
    s.diesel_uah_per_l = obs.price;
    s.effective_date = today;
    s.pending_decrease = null;
    event = 'raised';
  } else if (obs.price === current) {
    if (s.pending_decrease) event = 'decrease_cancelled';
    s.pending_decrease = null;
  } else {
    const p = s.pending_decrease;
    if (!p) {
      s.pending_decrease = { since: today, highest_seen: obs.price };
      event = 'decrease_pending';
    } else {
      p.highest_seen = Math.max(p.highest_seen, obs.price);
      event = 'decrease_pending';
      if (days(p.since, today) >= DECREASE_DELAY_DAYS) {
        s.diesel_uah_per_l = p.highest_seen;
        s.effective_date = today;
        s.pending_decrease = null;
        event = 'lowered';
      }
    }
  }

  // Only touch the file when something moved, or weekly, so the bot doesn't commit every day.
  const moved = event !== 'unchanged' || JSON.stringify(state.pending_decrease) !== JSON.stringify(s.pending_decrease);
  if (moved || !s.checked_date || days(s.checked_date, today) >= REFRESH_CHECKED_DAYS) {
    s.checked_date = today;
    s.market = { price: obs.price, date: obs.date };
  }
  return { state: s, event };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const today = new Date().toISOString().slice(0, 10);
  const state = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'ukrecopelleta.org fuel-price bot (+https://ukrecopelleta.org)' } });
  if (!res.ok) throw new Error(`${SOURCE_URL} answered ${res.status}`);
  const obs = parseMinfin(await res.text());
  console.log(`Minfin: diesel ${obs.price} UAH/l on ${obs.date}; ours ${state.diesel_uah_per_l} since ${state.effective_date}`);

  if (days(obs.date, today) > MAX_SOURCE_AGE_DAYS) {
    console.log(`Source data is ${days(obs.date, today)} days old; keeping the current price.`);
    return;
  }
  if (Math.abs(obs.price - state.diesel_uah_per_l) / state.diesel_uah_per_l > MAX_DAILY_JUMP) {
    throw new Error(`price moved more than ${MAX_DAILY_JUMP * 100}% (${state.diesel_uah_per_l} -> ${obs.price}); check the source by hand`);
  }

  const { state: next, event } = nextState(state, obs, today);
  console.log(`Result: ${event}; calculator uses ${next.diesel_uah_per_l} UAH/l`
    + (next.pending_decrease ? `; lower price pending since ${next.pending_decrease.since} (highest seen ${next.pending_decrease.highest_seen})` : ''));
  if (dryRun) return;
  const out = JSON.stringify(next, null, 2) + '\n';
  if (out !== fs.readFileSync(FILE, 'utf8')) fs.writeFileSync(FILE, out);
}

module.exports = { parseMinfin, nextState, DECREASE_DELAY_DAYS };

if (require.main === module) {
  main().catch((err) => {
    console.error(`Fuel price update failed: ${err.message}`);
    process.exit(1);
  });
}
