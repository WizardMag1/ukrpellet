import { execSync } from 'child_process';
import { handleTelegramUpdate } from '../cloudflare/bot.js';

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
if (ghToken) {
  console.log('GitHub sync enabled: Live website updates on every price change!');
}

let offset = 0;
while (true) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        console.log(`[Update ${update.update_id}] received:`, update.message ? update.message.text : update.callback_query ? update.callback_query.data : 'other');
        await handleTelegramUpdate(update, env);
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
    await new Promise(r => setTimeout(r, 2000));
  }
}
