# UkrPellet Backend Setup — Vercel + Supabase + Telegram
Complete free-tier infrastructure for instant B2B lead capture and alerts.

## 1. Create Supabase Project (Free)
1. Go to https://supabase.com/dashboard
2. Click "New Project" → any region (closest to Ukraine: `eu-central` or `us-east`)
3. Wait for provision (~2 min)
4. In **Project Settings → Database**, copy:
   - `Project URL` → save as `SUPABASE_URL`
   - `anon public` key → save as `SUPABASE_ANON_KEY`
5. In **SQL Editor**, paste and run `supabase-schema.sql`

## 2. Create Telegram Bot
1. Open Telegram → search `@BotFather`
2. Send `/newbot`
   - Bot name: `UkrPellet Leads`
   - Bot username: `ukrpellet_leads_bot` (or any available)
3. BotFather returns the **Bot Token** (format: `123456789:ABCdef...`)
4. Get your **Chat ID**:
   - Search `@userinfobot` in Telegram → `/start` → copy `chat.id`
   - (OR just message your new bot once, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and find `chat.id`)
5. Save both values

## 3. Deploy to Vercel (Free)
1. Push this repo to GitHub
2. Go to https://vercel.com → "Add New Project" → import your repo
3. Vercel auto-detects the project (no framework)
4. In **Settings → Environment Variables**, add:
   ```
   SUPABASE_URL        = https://YOUR-PROJECT.supabase.co
   SUPABASE_ANON_KEY  = eyJhbGciOi...
   TELEGRAM_BOT_TOKEN  = 123456789:ABCdef...
   TELEGRAM_CHAT_ID   = 123456789
   ```
5. Click **Deploy** (~30 sec)
6. Your site is now live at `https://your-project.vercel.app`
   - The `/api/lead` endpoint auto-routes to `api/lead.js`

## 4. Connect Your Domain (Optional)
- Vercel Dashboard → Project → Settings → Domains
- Add `ukrpellet.ua` (CNAME → `cname.vercel-dns.com`)

## 5. Test the Lead Pipeline
- Open your deployed site → fill the form → submit
- Within ~2 seconds you should see a Telegram message on your phone
- Check Supabase: **Table Editor → b2b_leads** → new row appears

## Environment Variables Reference
| Variable             | Source              | Example                                   |
|----------------------|---------------------|-------------------------------------------|
| `SUPABASE_URL`       | Supabase Settings   | `https://abc123.supabase.co`              |
| `SUPABASE_ANON_KEY`  | Supabase Settings   | `eyJhbGciOiJ...`                          |
| `TELEGRAM_BOT_TOKEN` | @BotFather          | `123456:ABCdef...`                        |
| `TELEGRAM_CHAT_ID`   | @userinfobot        | `123456789`                               |

> ⚠️ Never commit real keys to version control. Use `.env.example` as a template only.
