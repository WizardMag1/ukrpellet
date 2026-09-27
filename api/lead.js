// Vercel Edge-compatible serverless function for UkrEcoPelleta
// - Saves B2B lead to Supabase REST API (free auth + PostgreSQL DB)
// - Sends rich HTML notification to company email via Resend API
// - Fires instant Telegram Bot alert on mobile
// - Zero npm dependencies (native fetch, works on Node 18+ and Vercel Edge)

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const LEAD_EMAIL_FROM = process.env.LEAD_EMAIL_FROM || 'UkrEcoPelleta Leads <onboarding@resend.dev>';
const LEAD_EMAIL_TO = process.env.LEAD_EMAIL_TO || 'sales@ukrecopelleta.org';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://ukrecopelleta.org';

// Escape user input before embedding it in the HTML email
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const raw = req.body || {};

  // Honeypot: bots fill the hidden "website" field; pretend success and drop it
  if (raw.website) {
    return res.status(200).json({ success: true });
  }

  // Trim and cap every field; strings only
  const lead = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') lead[k] = v.trim().slice(0, 1000);
  }

  // Basic validation: must have at least phone, name, or email
  if (!lead.phone && !lead.email && !lead.name) {
    return res.status(400).json({ error: 'Потрібно вказати номер телефону або контактні дані' });
  }

  const timestamp = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const tasks = [];

  // ── 1. Save to Supabase DB ────────────────────────────────────────────────
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    tasks.push(
      fetch(`${SUPABASE_URL}/rest/v1/b2b_leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal, resolution=ignore-duplicates'
        },
        body: JSON.stringify({
          name: lead.name || null,
          phone: lead.phone || null,
          email: lead.email || null,
          city: lead.city || null,
          volume: lead.volume || null,
          // Logistics answers ride in the comment so the existing b2b_leads table needs no new columns
          comment: [
            lead.receive ? `Отримання: ${lead.receive}` : '',
            lead.vehicle ? `Транспорт клієнта: ${lead.vehicle}` : '',
            lead.unloading ? `Розвантаження: ${lead.unloading}` : '',
            lead.comment || ''
          ].filter(Boolean).join('\n') || null,
          utm_source: lead.utm_source || null,
          utm_medium: lead.utm_medium || null,
          utm_campaign: lead.utm_campaign || null,
          utm_term: lead.utm_term || null,
          utm_content: lead.utm_content || null,
          source: lead.source || 'web_form',
          status: 'new',
          created_at: new Date().toISOString()
        })
      }).catch(err => console.error('[Supabase Error]:', err.message))
    );
  }

  // ── 2. Send Email via Resend API ──────────────────────────────────────────
  if (RESEND_API_KEY) {
    const emailSubject = `🟢 Нова оптова заявка: ${lead.name || lead.city || 'Клієнт'} (${lead.volume || 'пелети'})`;
    const cleanPhone = (lead.phone || '').replace(/[^\d+]/g, '');

    const h = Object.fromEntries(Object.entries(lead).map(([k, v]) => [k, esc(v)]));
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px; color: #1a202c; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: #1e5631; color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.2px; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.85; }
    .body { padding: 28px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .info-table td { padding: 12px 14px; border-bottom: 1px solid #edf2f7; font-size: 14px; vertical-align: top; }
    .info-table td.label { width: 35%; font-weight: 600; color: #4a5568; background: #f7fafc; }
    .info-table td.val { color: #1a202c; }
    .highlight { font-weight: 700; color: #1e5631; font-size: 16px; }
    .cta-btn { display: inline-block; background: #22c55e; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; margin-right: 12px; margin-top: 8px; font-size: 14px; }
    .cta-tg { background: #0088cc; }
    .footer { padding: 16px 28px; background: #f8fafc; border-top: 1px solid #edf2f7; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🟢 Нова B2B Заявка на пелети</h1>
      <p>Сайт UkrEcoPelleta / ТОВ «УКРЕКОПЕЛЕТА» • ${timestamp}</p>
    </div>
    <div class="body">
      <table class="info-table">
        <tr>
          <td class="label">👤 Клієнт / Компанія:</td>
          <td class="val highlight">${h.name || '—'}</td>
        </tr>
        <tr>
          <td class="label">📞 Телефон:</td>
          <td class="val">
            <a href="tel:${cleanPhone}" style="color: #1e5631; font-weight: 700; font-size: 16px;">${h.phone || '—'}</a>
          </td>
        </tr>
        ${h.email ? `
        <tr>
          <td class="label">✉️ Email клієнта:</td>
          <td class="val"><a href="mailto:${h.email}">${h.email}</a></td>
        </tr>` : ''}
        <tr>
          <td class="label">📍 Населений пункт:</td>
          <td class="val">${h.city || '—'}</td>
        </tr>
        <tr>
          <td class="label">⚖️ Запитуваний об'єм:</td>
          <td class="val" style="font-weight: 600;">${h.volume || '—'}</td>
        </tr>
        ${h.receive ? `
        <tr>
          <td class="label">🚚 Отримання:</td>
          <td class="val" style="font-weight: 600;">${h.receive}</td>
        </tr>` : ''}
        ${h.vehicle ? `
        <tr>
          <td class="label">🚐 Транспорт клієнта:</td>
          <td class="val">${h.vehicle}</td>
        </tr>` : ''}
        ${h.unloading ? `
        <tr>
          <td class="label">🏗 Розвантаження:</td>
          <td class="val">${h.unloading}</td>
        </tr>` : ''}
        ${h.comment ? `
        <tr>
          <td class="label">💬 Примітка / Запит:</td>
          <td class="val">${h.comment}</td>
        </tr>` : ''}
        <tr>
          <td class="label">📊 Джерело реклами:</td>
          <td class="val" style="font-size: 12px; color: #718096;">
            UTM Source: <b>${h.utm_source || 'direct / organic'}</b><br>
            Кампанія: <b>${h.utm_campaign || '—'}</b><br>
            Ключове слово: <b>${h.utm_term || '—'}</b>
          </td>
        </tr>
      </table>

      <div>
        ${cleanPhone ? `<a href="tel:${cleanPhone}" class="cta-btn">📞 Зателефонувати клієнту</a>` : ''}
        ${cleanPhone ? `<a href="https://t.me/+${cleanPhone.replace('+', '')}" class="cta-btn cta-tg" target="_blank">💬 Написати в Telegram</a>` : ''}
      </div>
    </div>
    <div class="footer">
      Повідомлення згенеровано автоматично формою сайту UkrEcoPelleta (Нікополь, Дніпропетровська обл.).
    </div>
  </div>
</body>
</html>
    `.trim();

    const resendPayload = {
      from: LEAD_EMAIL_FROM,
      to: [LEAD_EMAIL_TO],
      subject: emailSubject,
      html: emailHtml
    };

    if (lead.email) {
      resendPayload.reply_to = lead.email;
    }

    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resendPayload)
      }).catch(err => console.error('[Resend Error]:', err.message))
    );
  }

  // ── 3. Send Telegram Bot notification ─────────────────────────────────────
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const msg = [
      '🟢 НОВА B2B ЗАЯВКА (UkrEcoPelleta)',
      '────────────────────────',
      `👤 Ім'я: ${lead.name || '—'}`,
      `📞 Телефон: ${lead.phone || '—'}`,
      lead.email ? `✉️ Email: ${lead.email}` : '',
      lead.city ? `📍 Місто: ${lead.city}` : '',
      lead.volume ? `⚖️ Об'єм: ${lead.volume}` : '',
      lead.receive ? `🚚 Отримання: ${lead.receive}` : '',
      lead.vehicle ? `🚐 Транспорт клієнта: ${lead.vehicle}` : '',
      lead.unloading ? `🏗 Розвантаження: ${lead.unloading}` : '',
      lead.comment ? `💬 Коментар: ${lead.comment}` : '',
      lead.utm_source ? `📊 Реклама: ${lead.utm_source} (${lead.utm_campaign || '—'})` : '',
      `🕐 ${timestamp}`
    ].filter(Boolean).join('\n');

    tasks.push(
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: msg
        })
      }).catch(err => console.error('[Telegram Error]:', err.message))
    );
  }

  // Await all async forwarding tasks
  await Promise.allSettled(tasks);

  return res.status(200).json({
    success: true,
    message: 'Заявку успішно прийнято. Менеджер зв\'яжеться з вами найближчим часом.'
  });
}
