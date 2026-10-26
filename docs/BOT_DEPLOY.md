# Price bot on Cloudflare (runs without your PC)

`@ukrecopelleta_bot` lets you and your managers change the pellet price and switch delivery on/off from Telegram.
Until now it ran on a PC (`scripts/dev-bot.mjs`), so it stopped when the PC was off. The same code
(`cloudflare/bot.js`) also runs inside the Cloudflare Worker `ukrecopelleta-edge`; Telegram then calls the Worker
directly (a webhook) and nothing needs to stay switched on.

```
Telegram button ─► Worker /api/telegram-webhook ─► KV (price, managers, invites)
                                 │                        │
                                 │                        └─► /api/pricing + HTMLRewriter: new price on the site at once
                                 └─► GitHub: commits data/pricing.json
                                              └─► Action "Price sync": sync-pricing.cjs rewrites the static pages,
                                                  RU copies, JSON-LD, llms*.txt, sitemap ─► Vercel redeploys (~1 min)
```

## One-time setup (about 15 minutes)

1. **New bot token.** The old token is in this repo's git history, so replace it: in Telegram open @BotFather →
   `/revoke` → pick `@ukrecopelleta_bot` → copy the new token.
2. **GitHub token for the bot.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate:
   repository `WizardMag1/ukrpellet` only, permission **Contents: Read and write**, expiry 1 year (set a reminder:
   when it expires, price changes still show on the site through KV but stop being committed).
3. **Webhook secret.** Any random string of letters, digits, `_` and `-`, e.g. `openssl rand -hex 24`.
4. **Deploy the Worker.** Merge the PR that carries this file. If Cloudflare Workers Builds is connected to the repo it
   deploys by itself (check Workers & Pages → ukrecopelleta-edge → Deployments). Otherwise, from the repo root:
   `npx wrangler login` once, then `npx wrangler deploy`.
5. **Add the three secrets** (Worker → Settings → Variables and Secrets → Add → type *Secret*, or
   `npx wrangler secret put NAME`):

   | Name | Value |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | the new token from step 1 |
   | `TELEGRAM_WEBHOOK_SECRET` | the string from step 3 |
   | `GITHUB_TOKEN` | the token from step 2 |

6. **Stop the PC bot** (Ctrl+C in the window running `dev-bot.mjs`). Telegram will not deliver webhooks while a
   `getUpdates` poller is running.
7. **Point Telegram at the Worker** (run once; replace the two placeholders):

   ```
   curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://ukrecopelleta.org/api/telegram-webhook" \
     -d "secret_token=<WEBHOOK_SECRET>"
   curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

   `getWebhookInfo` should show the URL and `"pending_update_count": 0` with no `last_error_message`.
8. **Test.** Send `/start` to the bot, set the price to its current value, and check that
   `https://ukrecopelleta.org/api/pricing` shows it, a commit appears on `data/pricing.json`, and the Actions tab runs
   *Price sync*.

The managers and invite links live in KV, so everyone you invited before the move has to be invited again once
(KV starts empty). Until the first price change the Worker reads the committed `data/pricing.json`, so the site keeps the
current price.

## Why the webhook is locked

Telegram sends the `TELEGRAM_WEBHOOK_SECRET` with every update. The Worker refuses any request without it (and refuses
everything when the secret is not set), because the webhook decides who is the owner from the message itself.
`scripts/worker-webhook.test.mjs` checks this in CI.

## Going back to the PC bot

`curl -s "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`, then
`TELEGRAM_BOT_TOKEN=<TOKEN> node scripts/dev-bot.mjs`. It commits and pushes by itself, so the *Price sync* Action only
finds the pages already up to date.
