// api/lead.js reports success only when the sales team was notified (email or Telegram bot). Run: node scripts/lead-api.test.mjs
const run = async (env, responder, body = { name: 'T', phone: '+380 99 123 45 67', logistics: 'Отримання: Доставка' }) => {
  for (const k of ['SUPABASE_URL','SUPABASE_ANON_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','RESEND_API_KEY','LEAD_EMAIL_FROM','LEAD_EMAIL_TO']) delete process.env[k];
  Object.assign(process.env, env);
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), body: init.body || '' }); const r = responder(String(url), init.body || '{}'); return { text: async () => '', ...r }; };
  const { default: handler } = await import(`../api/lead.js?${Math.random()}`);
  const out = {}; const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, end() { return this; } };
  const origErr = console.error; console.error = () => {};
  await handler({ method: 'POST', body }, res);
  console.error = origErr;
  return { ...out, calls };
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
// Phone, map pin and recipients: the Latvian lead of 19.10.2026 typed 0037126133794
const latvian = { name: 'Konstantins', phone: '0037126133794', city: 'iecava (за межами України)', geo: '56.59693,24.20621' };
const mail = (o) => JSON.parse(o.calls.find((c) => c.url.includes('resend'))?.body || '{}');
const tg = (o) => JSON.parse(o.calls.find((c) => c.url.includes('telegram'))?.body || '{}').text || '';
const both = { RESEND_API_KEY: 'k', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' };
const lv = await run({ ...both, LEAD_EMAIL_TO: 'sales@ukrecopelleta.org, Manager@Example.com' }, ok, latvian);
const junk = await run(both, ok, { name: 'X', phone: '12345' });
const extra = [
  ['junk phone refused with 400 invalid_phone, nobody notified', junk.code === 400 && junk.body.error === 'invalid_phone' && junk.calls.length === 0],
  ['00371 number stored as +371 2613 3794, country named', tg(lv).includes('📞 Телефон: +371 2613 3794 (Латвія)')],
  ['corrected number keeps what was typed', tg(await run(both, ok, { name: 'O', phone: '0991234567' })).includes('📞 Телефон: +380 99 123 45 67 (введено: 0991234567)')],
  ['Telegram button in the email points to t.me/+37126133794', mail(lv).html.includes('https://t.me/+37126133794"')],
  ['map pin becomes a Google Maps link', mail(lv).html.includes('https://www.google.com/maps?q=56.59693,24.20621') && tg(lv).includes('maps?q=56.59693,24.20621')],
  ['LEAD_EMAIL_TO accepts several addresses', JSON.stringify(mail(lv).to) === JSON.stringify(['sales@ukrecopelleta.org', 'Manager@Example.com'])],
  ['malformed pin is dropped', !mail(await run(both, ok, { ...latvian, geo: '1,2<script>' })).html.includes('maps?q=')],
];
for (const [name, pass] of extra) {
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
}

const hp = await (async () => { const o = {}; const { default: h } = await import(`../api/lead.js?${Math.random()}`); await h({ method: 'POST', body: { website: 'spam' } }, { setHeader() {}, status(c) { o.c = c; return this; }, json(b) { o.b = b; return this; } }); return o; })();
if (!(hp.c === 200 && hp.b.success)) fails++;
console.log(`${hp.c === 200 && hp.b.success ? 'PASS' : 'FAIL'} honeypot still answers 200 silently`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
if (fails) process.exit(1);
