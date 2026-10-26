// A price saved by the bot in the Worker must reach GitHub (data/pricing.json), and the owner must be told
// in Telegram when it does not: the bot used to say "site updated" while the commit was silently skipped.
import assert from 'node:assert';
import { savePricingConfig } from '../cloudflare/bot.js';

const kv = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };
const baseEnv = () => ({ PRICING_KV: kv(), TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_ADMIN_ID: '1' });
const user = { id: 1, username: 'owner' };

const run = async (env, github) => {
  const sent = []; const gh = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('https://api.telegram.org/')) { sent.push(JSON.parse(init.body).text); return new Response('{"ok":true}'); }
    gh.push(`${init.method || 'GET'} ${url}`);
    return github(init);
  };
  const updated = await savePricingConfig(env, { pricing: { pine_uah_per_t: 15000 } }, user);
  return { sent, gh, updated };
};

// 1. no GITHUB_TOKEN: price still saved, owner warned, no GitHub call
let r = await run(baseEnv(), () => { throw new Error('no GitHub call expected'); });
assert.strictEqual(r.updated.pricing.pine_uah_per_t, 15000);
assert.strictEqual(r.gh.length, 0);
assert.ok(r.sent.length === 1 && r.sent[0].includes('GITHUB_TOKEN'), 'owner told the token is missing');

// 2. token rejected by GitHub: owner told the status
r = await run({ ...baseEnv(), GITHUB_TOKEN: 'x' }, () => new Response('{"message":"Bad credentials"}', { status: 401 }));
assert.ok(r.sent.length === 1 && r.sent[0].includes('401'), 'owner told GitHub said 401');

// 3. success: file read, then written, nobody warned
r = await run({ ...baseEnv(), GITHUB_TOKEN: 'x' }, (init) => init.method === 'PUT'
  ? new Response('{"commit":{"sha":"abc"}}', { status: 200 })
  : new Response('{"sha":"old"}', { status: 200 }));
assert.deepStrictEqual(r.gh.map((s) => s.split(' ')[0]), ['GET', 'PUT']);
assert.strictEqual(r.sent.length, 0, 'no warning on success');

// 4. Node daemon (no KV binding): never writes through the API
r = await run({ TELEGRAM_BOT_TOKEN: 'tok', GITHUB_TOKEN: 'x' }, () => { throw new Error('no GitHub call expected'); });
assert.strictEqual(r.gh.length, 0);
console.log('✓ Bot price saves reach GitHub, and the owner is told when they do not');
