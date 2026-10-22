import { execSync } from 'child_process';
import { handleTelegramUpdate, getPricingConfig } from '../cloudflare/bot.js';

let ghToken = '';
try {
  ghToken = execSync('gh auth token').toString().trim();
} catch (e) {}

const env = {
  TELEGRAM_BOT_TOKEN: '8962858456:AAF0rwGGHsK6ViCBvqELVJeSnU19pe-wajw',
  TELEGRAM_ADMIN_ID: '788872538',
  TELEGRAM_BOT_USERNAME: 'ukrecopelleta_bot',
  TELEGRAM_WEBHOOK_SECRET: 'ukr_sec_98890c83_pelleta',
  GITHUB_TOKEN: ghToken
};

console.log('Bot runner started. Listening for updates from @ukrecopelleta_bot...');
console.log('Full SEO, Ads & Schema synchronization enabled!');

let offset = 0;
while (true) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        const actionType = update.message ? update.message.text : update.callback_query ? update.callback_query.data : 'other';
        console.log(`[Update ${update.update_id}] received:`, actionType);

        const beforeConfig = await getPricingConfig(env);
        await handleTelegramUpdate(update, env);
        const afterConfig = await getPricingConfig(env);

        // If pricing or delivery was modified, run system-wide sync across all 22 HTML pages, schemas, and git
        if (
          beforeConfig.pricing.pine_uah_per_t !== afterConfig.pricing.pine_uah_per_t ||
          beforeConfig.pricing.acacia_elm_uah_per_t !== afterConfig.pricing.acacia_elm_uah_per_t ||
          beforeConfig.delivery.enabled !== afterConfig.delivery.enabled ||
          beforeConfig.delivery.min_delivery_uah !== afterConfig.delivery.min_delivery_uah
        ) {
          console.log('Change detected! Running system-wide SEO & Schema sync...');
          try {
            try {
              execSync('git pull --rebase origin master', { stdio: 'inherit' });
            } catch (_) {}
            execSync('node scripts/sync-pricing.cjs', { stdio: 'inherit' });
            const changes = execSync('git status --porcelain').toString().trim();
            if (changes) {
              execSync('git add -A && git commit -m "chore(pricing): system-wide sync from @ukrecopelleta_bot" && git push origin master', { stdio: 'inherit' });
              console.log('✓ System-wide sync pushed to master!');
            } else {
              console.log('✓ Everything already up to date, nothing to commit.');
            }
          } catch (syncErr) {
            console.error('Local sync/push error:', syncErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
    await new Promise(r => setTimeout(r, 2000));
  }
}
