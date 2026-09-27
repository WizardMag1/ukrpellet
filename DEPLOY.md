# Deploy & ranking checklist — ukrecopelleta.org

Hosting: **Vercel** project `ukrecopelleta` builds the site (static pages + `api/lead.js`) from `master`.
The domain **ukrecopelleta.org** is served by the Cloudflare Worker `ukrecopelleta-edge` (`cloudflare/`), attached as a
custom domain. It 301-redirects `www` to the main domain and proxies all requests to `ukrpellet-ua.vercel.app`. To redeploy the Worker:
`cd cloudflare && npx wrangler deploy`. Site changes only need `git push`; the Worker needs no changes.
Cloudflare Workers Builds runs from the repo root, so the root `wrangler.toml` is a copy of
`cloudflare/wrangler.toml` with `main` pointing into `cloudflare/`. Change both; `scripts/check-wrangler.cjs` (CI) fails if they differ.
Before every deploy, run `npm run check`. It must print `✓ SEO check passed`; CI runs the same check.

## A. First deploy (one time, ~30 min)

**1. Vercel project**
- Import the repo in Vercel (framework preset: *Other*; no build command; output directory: `.`).
- In Settings → Environment Variables (Production), set:
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
  `RESEND_API_KEY`, `LEAD_EMAIL_TO=sales@ukrecopelleta.org`.
- In Settings → Domains, add `ukrecopelleta.org` and `www.ukrecopelleta.org`. `vercel.json` already 301-redirects www to the apex.

**2. Cloudflare DNS** (after moving the domain's nameservers to Cloudflare at your .com.ua registrar)

| Type  | Name | Content                | Proxy |
|-------|------|------------------------|-------|
| A     | @    | `76.76.21.21`          | Proxied (orange) |
| CNAME | www  | `cname.vercel-dns.com` | Proxied (orange) |

If Vercel shows "Invalid configuration" while the records are proxied, switch them to DNS-only (grey) until the certificate is issued, then turn the proxy back on.

**3. Cloudflare settings**
- SSL/TLS → **Full (strict)**. Edge Certificates → **Always Use HTTPS**: on.
- Speed → **Rocket Loader: off**, because it breaks the analytics and form scripts.
- Rules → Cache Rules → *Bypass cache* when the URI path starts with `/api/`.
- Email → **Email Routing**: create `sales@ukrecopelleta.org` and forward it to your real inbox.
- Optional: Web Analytics (cookie-free).

**4. Smoke test after DNS propagates**
```bash
curl -sI https://ukrecopelleta.org | grep -iE "HTTP/|strict-transport|cf-ray"
curl -sI https://www.ukrecopelleta.org | grep -iE "HTTP/|location"
curl -s -o /dev/null -w "%{http_code}\n" https://ukrecopelleta.org/README.md
```
Expected results: `200` with HSTS and `cf-ray` for the first command, a `301` to the apex for the second, and `404` for the third (internal docs aren't published).
Finally, submit a real lead through the form and check that it reaches Telegram, email and Supabase.

## B. Getting to #1 for "купити пелети Нікополь"

On-site work is done: pages `/pelety-nikopol`, `/pelety-dnipro`, `/pelety-optom`, schema, sitemap. The ranking levers below are off-site, and only you can do them, in this order:

1. **Google Business Profile** — this is the biggest lever for local and map results.
   - Register the Nikopol plant address with category "Постачальник палива" (secondary: "Виробник").
   - Website: `https://ukrecopelleta.org/pelety-nikopol`.
   - Add 10+ real photos (warehouse, big bags, loading), price range, working hours.
   - Publish a post weekly during the heating season.
2. **Google Search Console + Bing Webmaster Tools.**
   - Verify the domain through a Cloudflare DNS TXT record.
   - Submit `https://ukrecopelleta.org/sitemap.xml`.
   - Use "Request indexing" for `/`, `/pellets`, `/pelety-nikopol`, `/pelety-dnipro`, `/pelety-optom`.
3. **Consistent name, address and phone everywhere:** "ТОВ «УКРЕКОПЕЛЕТА»", Нікополь, +38 (066) 403-53-96. Use exactly this on:
   - prom.ua and OLX (list pellets with a link to the site);
   - the Opendatabot and YouControl company cards;
   - Ukrainian business catalogs.
   Don't use Russian services (2GIS, Yandex).
4. **Reviews.** After every pickup or delivery, ask the client for a Google review. Target 20+ reviews in the first season, and reply to every one.
5. **Links.**
   - Local Nikopol and Dnipro news sites, e.g. a short story about the plant.
   - ОСББ and agro forums.
   - Partner and client pages (boiler installers, stove shops).
6. **Google Ads** on "пелети Нікополь", "купити пелети Нікополь" and "пелети Дніпро" while organic rankings grow. Organic results take about 1–3 months.

Realistic target: top 3 in Google for "пелети Нікополь" within 1–3 months, and map-pack #1 once the Business Profile has reviews. No one can guarantee #1 for every search. Consistent reviews and profile activity are what keep you there.

## C. Adding or changing a page

1. Edit or create the `.html` file with its own `<title>`, meta description (≤160 chars), one `<h1>`, and a canonical of `https://ukrecopelleta.org/<path>`.
2. Add the URL to `sitemap.xml`, and to `llms.txt` if it's a key page.
3. Run `npm run check`. It fails if something is missing, broken or points at an old domain.
