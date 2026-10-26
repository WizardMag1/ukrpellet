// The Telegram webhook must refuse any request that does not carry the secret registered with setWebhook:
// otherwise anyone could post a forged update as the owner and change the prices.
import assert from 'node:assert';
import worker from '../cloudflare/worker.js';

const post = (headers) => new Request('https://ukrecopelleta.org/api/telegram-webhook', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({ update_id: 1 }),
});
const status = async (req, env) => (await worker.fetch(req, env)).status;
const base = { CANONICAL_HOST: 'ukrecopelleta.org', ORIGIN: 'origin.invalid', TELEGRAM_BOT_TOKEN: 't' };

assert.strictEqual(await status(post({}), { ...base, TELEGRAM_WEBHOOK_SECRET: 's3cret' }), 401, 'no header');
assert.strictEqual(await status(post({ 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }), { ...base, TELEGRAM_WEBHOOK_SECRET: 's3cret' }), 401, 'wrong header');
assert.strictEqual(await status(post({}), base), 401, 'no secret configured, no header');
assert.strictEqual(await status(post({ 'X-Telegram-Bot-Api-Secret-Token': 'undefined' }), base), 401, 'no secret configured');
assert.strictEqual(await status(post({ 'X-Telegram-Bot-Api-Secret-Token': 's3cret' }), { ...base, TELEGRAM_WEBHOOK_SECRET: 's3cret' }), 200, 'right header');
const setup = new Request('https://ukrecopelleta.org/api/admin/setup-webhook?key=anything');
assert.strictEqual(await status(setup, base), 403, 'setup-webhook closed without a secret');
console.log('✓ Telegram webhook refuses requests without the secret');
