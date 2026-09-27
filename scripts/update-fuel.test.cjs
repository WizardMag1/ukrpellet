// Tests for the diesel price rule in update-fuel.cjs. Run: node scripts/update-fuel.test.cjs
const assert = require('assert');
const { nextState, parseMinfin } = require('./update-fuel.cjs');

const base = { diesel_uah_per_l: 98.42, effective_date: '2026-09-01', checked_date: '2026-09-01', pending_decrease: null };
const obs = (price, date) => ({ price, date });

function run(start, days) {
  let s = start;
  const events = [];
  for (const [date, price] of days) {
    const r = nextState(s, obs(price, date), date);
    s = r.state;
    events.push(r.event);
  }
  return { s, events };
}

const tests = {
  'a rise is used the same day'() {
    const { state, event } = nextState(base, obs(99.1, '2026-09-10'), '2026-09-10');
    assert.strictEqual(event, 'raised');
    assert.strictEqual(state.diesel_uah_per_l, 99.1);
    assert.strictEqual(state.effective_date, '2026-09-10');
  },
  'a drop is held for a week'() {
    const { s, events } = run(base, [
      ['2026-09-10', 97.9], ['2026-09-11', 97.8], ['2026-09-12', 97.8], ['2026-09-13', 97.7],
      ['2026-09-14', 97.7], ['2026-09-15', 97.6], ['2026-09-16', 97.6],
    ]);
    assert.deepStrictEqual(events, Array(7).fill('decrease_pending'));
    assert.strictEqual(s.diesel_uah_per_l, 98.42);
    assert.deepStrictEqual(s.pending_decrease, { since: '2026-09-10', highest_seen: 97.9 });
  },
  'after 7 days below, the price drops to the highest seen that week'() {
    const { s, events } = run(base, [
      ['2026-09-10', 97.5], ['2026-09-12', 97.9], ['2026-09-14', 97.2], ['2026-09-17', 97.0],
    ]);
    assert.strictEqual(events.at(-1), 'lowered');
    assert.strictEqual(s.diesel_uah_per_l, 97.9);
    assert.strictEqual(s.effective_date, '2026-09-17');
    assert.strictEqual(s.pending_decrease, null);
  },
  'a dip that recovers never lowers the price'() {
    const { s, events } = run(base, [['2026-09-10', 97.5], ['2026-09-13', 98.42], ['2026-09-18', 97.9]]);
    assert.deepStrictEqual(events, ['decrease_pending', 'decrease_cancelled', 'decrease_pending']);
    assert.strictEqual(s.diesel_uah_per_l, 98.42);
    assert.strictEqual(s.pending_decrease.since, '2026-09-18');
  },
  'a rise during a pending drop is used at once'() {
    const { s, events } = run(base, [['2026-09-10', 97.5], ['2026-09-12', 99.3]]);
    assert.deepStrictEqual(events, ['decrease_pending', 'raised']);
    assert.strictEqual(s.diesel_uah_per_l, 99.3);
    assert.strictEqual(s.pending_decrease, null);
  },
  'missed days still count toward the week'() {
    const { s, events } = run(base, [['2026-09-10', 97.5], ['2026-09-20', 97.4]]);
    assert.deepStrictEqual(events, ['decrease_pending', 'lowered']);
    assert.strictEqual(s.diesel_uah_per_l, 97.5);
  },
  'an unchanged price only re-stamps the check date weekly'() {
    const fresh = { ...base, checked_date: '2026-09-09' };
    assert.strictEqual(nextState(fresh, obs(98.42, '2026-09-10'), '2026-09-10').state.checked_date, '2026-09-09');
    assert.strictEqual(nextState(fresh, obs(98.42, '2026-09-16'), '2026-09-16').state.checked_date, '2026-09-16');
  },
  'reads price and date from the Minfin table'() {
    const html = `<table class='line'><caption>Средние цены на горючее по Украине на&nbsp;25.09.2026</caption>
      <tr><td><a href='/markets/fuel/a92/'>Бензин А-92</a></td><td><br></td><td><big>85,98</big></td></tr>
      <tr><td><a href='/markets/fuel/dt/'>Дизельное топливо</a></td><td align='center'><br></td><td align='right'><big>98,42</big></td></tr></table>`;
    assert.deepStrictEqual(parseMinfin(html), { price: 98.42, date: '2026-09-25' });
  },
  'refuses a page without the diesel row'() {
    assert.throws(() => parseMinfin('<caption>на 25.09.2026</caption><big>85,98</big>'), /diesel row/);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n  ${e.message}`); }
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all fuel rule tests passed');
