import assert from 'node:assert';
import {
  DEFAULT_CONFIG,
  getPricingConfig,
  savePricingConfig,
  isAuthorized,
  renderMainMenu,
  renderTariffsMenu,
  handleTelegramUpdate
} from '../cloudflare/bot.js';

console.log('Testing bot and pricing engine...');

const mockEnv = {
  TELEGRAM_BOT_TOKEN: '8962858456:AAF0rwGGHsK6ViCBvqELVJeSnU19pe-wajw',
  TELEGRAM_ADMIN_ID: '788872538',
  TELEGRAM_BOT_USERNAME: 'ukrecopelleta_bot',
  TELEGRAM_WEBHOOK_SECRET: 'test_secret'
};

// 1. Initial config
const cfg1 = await getPricingConfig(mockEnv);
assert.strictEqual(cfg1.pricing.pine_uah_per_t, 14500, 'Initial pine price should be 14500');
assert.strictEqual(cfg1.delivery.enabled, true, 'Delivery should be enabled by default');

// 2. Authorization check
const authOwner = await isAuthorized(mockEnv, 788872538);
assert.strictEqual(authOwner.authorized, true);
assert.strictEqual(authOwner.role, 'owner');

const authStranger = await isAuthorized(mockEnv, 999999999);
assert.strictEqual(authStranger.authorized, false);
assert.strictEqual(authStranger.role, 'none');

// 3. Save config
const updatedCfg = await savePricingConfig(mockEnv, {
  pricing: { pine_uah_per_t: 14800 },
  delivery: { enabled: false }
}, { id: 788872538, username: 'wizard' });

assert.strictEqual(updatedCfg.pricing.pine_uah_per_t, 14800);
assert.strictEqual(updatedCfg.delivery.enabled, false);
assert.strictEqual(updatedCfg.updated_by_name, '@wizard');

// 4. Render main menu
const menu = renderMainMenu(updatedCfg, 'owner', 'Wizard');
const formattedPrice = (14800).toLocaleString('uk-UA');
assert(menu.text.includes(formattedPrice), 'Menu should show updated price');
assert(menu.text.includes('ВИМКНЕНО'), 'Menu should show delivery paused');
assert(menu.keyboard.some(row => row.some(b => b.callback_data === 'create_invite')), 'Owner should see invite button');

// 5. Render tariffs menu
const tariffs = renderTariffsMenu(updatedCfg);
const formattedDelivery = (15000).toLocaleString('uk-UA');
assert(tariffs.text.includes(formattedDelivery), 'Tariffs menu should show minimum delivery');
assert(tariffs.keyboard.some(row => row.some(b => b.callback_data === 'edit_driver_rate')), 'Tariffs should have driver rate button');

console.log('✓ All bot engine unit tests passed successfully!');
