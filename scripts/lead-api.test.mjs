// api/lead.js reports success only when the sales team was notified (email or Telegram bot). Run: node scripts/lead-api.test.mjs
const run = async (env, responder) => {
  for (const k of ['SUPABASE_URL','SUPABASE_ANON_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','RESEND_API_KEY','LEAD_EMAIL_FROM']) delete process.env[k];
  Object.assign(process.env, env);
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push(String(url)); const r = responder(String(url), init.body || '{}'); return { text: async () => '', ...r }; };
  const { default: handler } = await import(`../api/lead.js?${Math.random()}`);
  const out = {}; const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, end() { return this; } };
  const origErr = console.error; console.error = () => {};
  await handler({ method: 'POST', body: { name: 'T', phone: '+380', logistics: 'Отримання: Доставка' } }, res);
  console.error = origErr;
  return { ...out, calls: calls.length };
};
const ok = () => ({ ok: true, status: 200 }), bad = () => ({ ok: false, status: 401 });
const cases = [
  ['nothing configured -> 503', {}, ok, 503],
  ['only Supabase ok -> 503 (nobody notified)', { SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'k' }, ok, 503],
  ['Resend ok -> 200', { RESEND_API_KEY: 'k' }, ok, 200],
  ['Resend rejects -> 503', { RESEND_API_KEY: 'k' }, bad, 503],
  ['Resend rejects, Telegram ok -> 200', { RESEND_API_KEY: 'k', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' }, (u) => u.includes('resend') ? bad() : ok(), 200],
  ['sender domain unverified (403) -> retried from resend.dev -> 200', { RESEND_API_KEY: 'k', LEAD_EMAIL_FROM: 'X <leads@example.org>' }, (u, body) => (JSON.parse(body).from.includes('resend.dev') ? ok() : { ok: false, status: 403 }), 200],
  ['fallback sender also rejected -> 503', { RESEND_API_KEY: 'k', LEAD_EMAIL_FROM: 'X <leads@example.org>' }, () => ({ ok: false, status: 403 }), 503],
  ['network error everywhere -> 503', { RESEND_API_KEY: 'k', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' }, () => { throw new Error('down'); }, 503],
];
let fails = 0;
for (const [name, env, r, want] of cases) {
  const o = await run(env, r);
  const pass = o.code === want && (want === 200) === (o.body?.success === true);
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} (got ${o.code})`);
}
const hp = await (async () => { const o = {}; const { default: h } = await import(`../api/lead.js?${Math.random()}`); await h({ method: 'POST', body: { website: 'spam' } }, { setHeader() {}, status(c) { o.c = c; return this; }, json(b) { o.b = b; return this; } }); return o; })();
if (!(hp.c === 200 && hp.b.success)) fails++;
console.log(`${hp.c === 200 && hp.b.success ? 'PASS' : 'FAIL'} honeypot still answers 200 silently`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
if (fails) process.exit(1);
