// Edge entry for ukrecopelleta.org: serves the Vercel-hosted site under the real domain.
// Intercepts /api/pricing (dynamic pellet prices and delivery tariffs from KV)
// Intercepts /api/telegram-webhook (Telegram management bot for the factory owner and managers)
// www -> apex 301; everything else is proxied to the Vercel origin.

import { getPricingConfig, handleTelegramUpdate } from './bot.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = env.CANONICAL_HOST || url.hostname;

    // Apex canonical redirect
    if (env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST) {
      url.hostname = env.CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    // 1. Dynamic Pricing & Delivery API Endpoint
    if (url.pathname === '/api/pricing') {
      const config = await getPricingConfig(env);
      return new Response(JSON.stringify(config), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60'
        }
      });
    }

    // 2. Telegram Webhook for Bot (@ukrecopelleta_bot)
    if (url.pathname === '/api/telegram-webhook' && request.method === 'POST') {
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET || 'ukr_sec_98890c83_pelleta';
      if (secret && secret !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const update = await request.json();
        // Process update in background (waitUntil keeps execution alive)
        // or await directly
        await handleTelegramUpdate(update, env);
      } catch (err) {
        console.error('[Telegram webhook error]', err);
      }
      return new Response('OK', { status: 200 });
    }

    // 3. Admin Webhook Registration Helper
    if (url.pathname === '/api/admin/setup-webhook') {
      const key = url.searchParams.get('key');
      const expectedKey = env.TELEGRAM_WEBHOOK_SECRET || 'ukr_sec_98890c83_pelleta';
      if (key !== expectedKey) {
        return new Response('Forbidden', { status: 403 });
      }
      const token = env.TELEGRAM_BOT_TOKEN || '8962858456:AAF0rwGGHsK6ViCBvqELVJeSnU19pe-wajw';
      const webhookUrl = `https://${host}/api/telegram-webhook`;
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: expectedKey,
          drop_pending_updates: false
        })
      });
      const data = await tgRes.json();
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Default: Proxy to Vercel origin
    const upstream = new URL(url.pathname + url.search, `https://${env.ORIGIN}`);
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', host);

    const res = await fetch(upstream, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    // Keep redirects on our domain
    const loc = res.headers.get('Location');
    if (loc && loc.includes(env.ORIGIN)) {
      const out = new Response(res.body, res);
      out.headers.set('Location', loc.replace(`https://${env.ORIGIN}`, `https://${host}`));
      return out;
    }

    // Dynamic Edge HTML Rewriter for Instant Zero-Delay Price Rendering
    if (res.status === 200 && res.headers.get('content-type')?.includes('text/html')) {
      try {
        const config = await getPricingConfig(env);
        const pine = Number(config.pricing?.pine_uah_per_t) || 14000;
        const mix = Number(config.pricing?.acacia_elm_uah_per_t) || pine;
        const min = Math.min(pine, mix);
        const fmtMin = min.toLocaleString('uk-UA').replace(/\u00a0/g, ' ');
        const isRu = url.pathname.startsWith('/ru');
        const prefix = isRu ? 'от' : 'від';
        const factText = pine === mix ? fmtMin : `${prefix} ${fmtMin}`;

        const rewriter = new HTMLRewriter()
          .on('[data-dynamic-price="facts"], .buy-facts strong', {
            element(el) {
              el.setInnerContent(factText);
            }
          })
          .on('[data-dynamic-price="pine"]', {
            element(el) {
              el.setInnerContent(pine.toLocaleString('uk-UA').replace(/\u00a0/g, ' '));
            }
          });

        const transformed = rewriter.transform(res);
        const out = new Response(transformed.body, transformed);
        out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
        return out;
      } catch (rewriteErr) {
        console.error('[HTMLRewriter error]', rewriteErr);
      }
    }

    return new Response(res.body, res);
  },
};
