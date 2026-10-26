/**
 * UkrEcoPelleta — Telegram Management Bot & Dynamic Pricing Engine
 * Powered by Cloudflare Workers & KV
 */

export const DEFAULT_CONFIG = {
  pricing: {
    pine_uah_per_t: 14500,
    acacia_elm_uah_per_t: 14500
  },
  delivery: {
    enabled: true,
    min_tons: 15,
    min_delivery_uah: 15000,
    driver_uah_per_km: 4.0
  },
  updated_at: null,
  updated_by: null,
  updated_by_name: null
};

// In-memory fallback for local preview or uninitialized KV
const memoryStore = new Map();

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function getKV(env, key) {
  if (env && env.PRICING_KV) {
    try {
      const val = await env.PRICING_KV.get(key, 'json');
      if (val !== null) return val;
    } catch (e) {
      console.error('[KV get error]', e);
    }
  }
  if (key === 'config:pricing') {
    if (memoryStore.has(key)) return memoryStore.get(key);
    if (typeof process !== 'undefined') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const p = path.join(process.cwd(), 'data', 'pricing.json');
        if (fs.existsSync(p)) {
          const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
          memoryStore.set(key, cfg);
          return cfg;
        }
      } catch (_) {}
    }
  }
  return memoryStore.get(key) || null;
}

export async function putKV(env, key, value, ttlSeconds) {
  memoryStore.set(key, value);
  if (env && env.PRICING_KV) {
    try {
      const opts = ttlSeconds ? { expirationTtl: ttlSeconds } : undefined;
      await env.PRICING_KV.put(key, JSON.stringify(value), opts);
    } catch (e) {
      console.error('[KV put error]', e);
    }
  }
  if (key === 'config:pricing' && typeof process !== 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const p = path.join(process.cwd(), 'data', 'pricing.json');
      fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8');
    } catch (_) {}
  }
}

export async function deleteKV(env, key) {
  memoryStore.delete(key);
  if (env && env.PRICING_KV) {
    try {
      await env.PRICING_KV.delete(key);
    } catch (e) {
      console.error('[KV delete error]', e);
    }
  }
}

function normalizeConfig(saved) {
  return {
    pricing: {
      pine_uah_per_t: Number(saved.pricing?.pine_uah_per_t) || DEFAULT_CONFIG.pricing.pine_uah_per_t,
      acacia_elm_uah_per_t: Number(saved.pricing?.acacia_elm_uah_per_t) || DEFAULT_CONFIG.pricing.acacia_elm_uah_per_t
    },
    delivery: {
      enabled: saved.delivery?.enabled !== false,
      min_tons: Number(saved.delivery?.min_tons) || DEFAULT_CONFIG.delivery.min_tons,
      min_delivery_uah: Number(saved.delivery?.min_delivery_uah) || DEFAULT_CONFIG.delivery.min_delivery_uah,
      driver_uah_per_km: Number(saved.delivery?.driver_uah_per_km) || DEFAULT_CONFIG.delivery.driver_uah_per_km
    },
    updated_at: saved.updated_at || null,
    updated_by: saved.updated_by || null,
    updated_by_name: saved.updated_by_name || null
  };
}

// KV is empty until the first price change in the bot. Until then the Worker would serve DEFAULT_CONFIG and
// stamp those prices over the pages, so it reads the committed data/pricing.json from the Vercel origin instead.
async function readCommittedConfig(env) {
  if (!env?.ORIGIN) return null;
  try {
    const res = await fetch(`https://${env.ORIGIN}/api/pricing`, { cf: { cacheTtl: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.pricing?.pine_uah_per_t ? data : null;
  } catch (e) {
    console.error('[committed pricing read error]', e);
    return null;
  }
}

export async function getPricingConfig(env) {
  const saved = (await getKV(env, 'config:pricing')) || (await readCommittedConfig(env));
  return saved ? normalizeConfig(saved) : DEFAULT_CONFIG;
}

export async function savePricingConfig(env, newConfig, user) {
  const current = await getPricingConfig(env);
  const updated = {
    pricing: { ...current.pricing, ...(newConfig.pricing || {}) },
    delivery: { ...current.delivery, ...(newConfig.delivery || {}) },
    updated_at: new Date().toISOString(),
    updated_by: user ? String(user.id) : null,
    updated_by_name: user ? (user.username ? `@${user.username}` : user.first_name || 'Менеджер') : null
  };
  await putKV(env, 'config:pricing', updated);

  // Sync directly to GitHub repository if running in Cloudflare Workers (where Git CLI is absent).
  // The Worker has the PRICING_KV binding; when the Node daemon (dev-bot.mjs) runs, it performs an atomic
  // git commit + push for all files itself, so it must not also write through the API.
  if (env?.PRICING_KV) {
    const warnOwner = async (reason) => {
      console.error('[GitHub sync]', reason);
      try {
        await callTelegram(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: Number(env.TELEGRAM_ADMIN_ID || 788872538),
          text: `⚠️ <b>Ціну збережено на сайті, але не записано в GitHub.</b>\n${escapeHtml(reason)}\n` +
            'Заголовки сторінок і мікророзмітка Google залишаться зі старою ціною, доки це не виправити.',
          parse_mode: 'HTML'
        });
      } catch (_) {}
    };
    const ghToken = env.GITHUB_TOKEN || '';
    if (!ghToken) {
      await warnOwner('У Worker немає секрету GITHUB_TOKEN (docs/BOT_DEPLOY.md, крок 2 і 5).');
    } else {
      try {
        const apiUrl = 'https://api.github.com/repos/WizardMag1/ukrpellet/contents/data/pricing.json';
        const getRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${ghToken}`,
            'User-Agent': 'ukrecopelleta-bot',
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        let sha = null;
        if (getRes.ok) {
          const fileObj = await getRes.json();
          sha = fileObj.sha;
        } else if (getRes.status !== 404) {
          await warnOwner(`GitHub відповів ${getRes.status} на читання data/pricing.json (перевірте права токена: Contents, Read and write).`);
          return updated;
        }
        const jsonStr = JSON.stringify(updated, null, 2);
        const b64 = typeof Buffer !== 'undefined'
          ? Buffer.from(jsonStr).toString('base64')
          : btoa(unescape(encodeURIComponent(jsonStr)));

        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${ghToken}`,
            'User-Agent': 'ukrecopelleta-bot',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Price update: Pine ${updated.pricing.pine_uah_per_t} UAH, Delivery ${updated.delivery.enabled ? 'ON' : 'OFF'} (via @ukrecopelleta_bot)`,
            content: b64,
            sha: sha || undefined
          })
        });
        if (!putRes.ok) {
          await warnOwner(`GitHub відповів ${putRes.status} на запис data/pricing.json (перевірте права токена: Contents, Read and write).`);
        }
      } catch (err) {
        await warnOwner(`Помилка зв'язку з GitHub: ${err.message}`);
      }
    }
  }

  return updated;
}

export async function callTelegram(token, method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`[Telegram error in ${method}]:`, JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.error(`[Telegram fetch error in ${method}]:`, err.message);
    return { ok: false, error: err.message };
  }
}

export async function isAuthorized(env, userId) {
  const numId = Number(userId);
  const ownerId = Number(env.TELEGRAM_ADMIN_ID || 788872538);
  if (numId === ownerId) {
    return { authorized: true, role: 'owner' };
  }
  const users = (await getKV(env, 'auth:users')) || {};
  if (users[numId] || users[String(userId)]) {
    const user = users[numId] || users[String(userId)];
    return { authorized: true, role: user.role || 'manager' };
  }
  return { authorized: false, role: 'none' };
}

export function renderMainMenu(config, userRole, name) {
  const p = config.pricing;
  const d = config.delivery;
  const deliveryStatusText = d.enabled ? '🟢 УВІМКНЕНО (доставка працює)' : '🔴 ВИМКНЕНО (тільки самовивіз)';
  const lastUpdated = config.updated_at
    ? new Date(config.updated_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })
    : 'Початкові налаштування';
  const updatedBy = config.updated_by_name ? ` (${escapeHtml(config.updated_by_name)})` : '';
  const safeName = escapeHtml(name);

  const text = `🌲 <b>UkrEcoPelleta — Керування цінами та доставкою</b>\n\n` +
    `📊 <b>Поточні налаштування на сайті ukrecopelleta.org:</b>\n` +
    `• Сосна 100%: <b>${p.pine_uah_per_t.toLocaleString('uk-UA')} грн/т</b>\n` +
    `• Акація + берест: <b>${p.acacia_elm_uah_per_t.toLocaleString('uk-UA')} грн/т</b>\n` +
    `• Доставка автопарком: <b>${deliveryStatusText}</b>\n` +
    `• Поріг партії для доставки: <b>від ${d.min_tons || 15} т</b>\n` +
    `• Мін. тариф рейсу: <b>${(d.min_delivery_uah || 15000).toLocaleString('uk-UA')} грн</b>\n` +
    `• Ставка водія: <b>${d.driver_uah_per_km || 4.00} грн/км</b>\n\n` +
    `👤 <b>Ви:</b> ${safeName} (${userRole === 'owner' ? 'Власник' : 'Менеджер'})\n` +
    `🕒 <b>Останнє оновлення:</b> ${lastUpdated}${updatedBy}`;

  const keyboard = [
    [
      { text: `💰 Змінити базову ціну (усі пелети)`, callback_data: 'edit_all_prices' }
    ],
    [
      { text: `🌲 Тільки сосна (${p.pine_uah_per_t})`, callback_data: 'edit_pine' },
      { text: `🌳 Тільки мікс (${p.acacia_elm_uah_per_t})`, callback_data: 'edit_acacia' }
    ],
    [
      {
        text: d.enabled ? '🚚 Доставка: 🟢 УВІМК (натисніть щоб вимкнути)' : '🚚 Доставка: 🔴 ВИМК (натисніть щоб увімкнути)',
        callback_data: 'toggle_delivery'
      }
    ],
    [
      { text: '⚙️ Налаштувати тарифи доставки', callback_data: 'menu_tariffs' }
    ]
  ];

  if (userRole === 'owner') {
    keyboard.push([
      { text: '➕ Запросити менеджера', callback_data: 'create_invite' },
      { text: '👥 Список менеджерів', callback_data: 'list_managers' }
    ]);
  }

  keyboard.push([
    { text: '🔄 Оновити статус', callback_data: 'refresh_menu' }
  ]);

  return { text, keyboard };
}

export function renderTariffsMenu(config) {
  const d = config.delivery;
  const text = `⚙️ <b>Налаштування логістики та тарифів доставки:</b>\n\n` +
    `• Мінімальна партія для виїзду фури: <b>${d.min_tons || 15} т</b>\n` +
    `• Мінімальна сума замовлення доставки: <b>${(d.min_delivery_uah || 15000).toLocaleString('uk-UA')} грн</b>\n` +
    `• Оплата водієві: <b>${d.driver_uah_per_km || 4.00} грн/км</b>\n\n` +
    `Оберіть параметр для зміни:`;

  const keyboard = [
    [
      { text: `💰 Мін. сума (${d.min_delivery_uah} грн)`, callback_data: 'edit_min_delivery' },
      { text: `📏 Водій (${d.driver_uah_per_km} грн/км)`, callback_data: 'edit_driver_rate' }
    ],
    [
      { text: `📦 Поріг ваги (${d.min_tons} т)`, callback_data: 'edit_min_tons' }
    ],
    [
      { text: '⬅️ Назад до головного меню', callback_data: 'back_to_main' }
    ]
  ];

  return { text, keyboard };
}

/**
 * Handle incoming Telegram webhook updates
 */
export async function handleTelegramUpdate(update, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const ownerId = Number(env.TELEGRAM_ADMIN_ID || 788872538);

  // 1. Handle Inline Button Clicks (Callback Queries)
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;
    const userName = cb.from.username ? `@${cb.from.username}` : cb.from.first_name || 'Менеджер';
    const auth = await isAuthorized(env, userId);

    if (!auth.authorized) {
      await callTelegram(token, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '⛔️ У вас немає доступу. Зверніться до власника.',
        show_alert: true
      });
      return;
    }

    const data = cb.data;
    const config = await getPricingConfig(env);

    // Refresh Menu
    if (data === 'refresh_menu' || data === 'back_to_main') {
      const menu = renderMainMenu(config, auth.role, userName);
      await callTelegram(token, 'editMessageText', {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: menu.keyboard }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Toggle Delivery
    if (data === 'toggle_delivery') {
      const newEnabled = !config.delivery.enabled;
      const updated = await savePricingConfig(env, { delivery: { enabled: newEnabled } }, cb.from);
      const menu = renderMainMenu(updated, auth.role, userName);

      await callTelegram(token, 'editMessageText', {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: menu.keyboard }
      });
      await callTelegram(token, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: newEnabled ? '✅ Доставку увімкнено на сайті!' : '⚠️ Доставку вимкнено (тільки самовивіз)!',
        show_alert: true
      });
      return;
    }

    // Delivery Tariffs Submenu
    if (data === 'menu_tariffs') {
      const menu = renderTariffsMenu(config);
      await callTelegram(token, 'editMessageText', {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: menu.keyboard }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Edit All Prices prompt
    if (data === 'edit_all_prices') {
      await putKV(env, `state:${userId}`, { action: 'await_all_price' }, 600);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `💰 <b>Введіть нову базову ціну для ВСІХ пелет (сосна + мікс) у грн/т:</b>\n\n` +
          `Поточна ціна сосни: <b>${config.pricing.pine_uah_per_t} грн/т</b>\n` +
          `Поточна ціна міксу: <b>${config.pricing.acacia_elm_uah_per_t} грн/т</b>\n\n` +
          `Введіть тільки число (наприклад: <code>15500</code>):`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Edit Pine Price prompt
    if (data === 'edit_pine') {
      await putKV(env, `state:${userId}`, { action: 'await_pine_price' }, 600);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `🌲 <b>Введіть нову ціну соснових пелет (грн/т):</b>\n\n` +
          `Поточна ціна: <b>${config.pricing.pine_uah_per_t} грн/т</b>\n` +
          `Введіть тільки число (наприклад: <code>14800</code>):`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Edit Acacia Price prompt
    if (data === 'edit_acacia') {
      await putKV(env, `state:${userId}`, { action: 'await_acacia_price' }, 600);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `🌳 <b>Введіть нову ціну пелет міксу (акація+берест) в грн/т:</b>\n\n` +
          `Поточна ціна: <b>${config.pricing.acacia_elm_uah_per_t} грн/т</b>\n` +
          `Введіть тільки число (наприклад: <code>14500</code>):`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Edit Min Delivery Fee prompt
    if (data === 'edit_min_delivery') {
      await putKV(env, `state:${userId}`, { action: 'await_min_delivery' }, 600);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `💰 <b>Введіть мінімальну вартість рейсу доставки (грн):</b>\n\n` +
          `Поточний мінімум: <b>${config.delivery.min_delivery_uah} грн</b>\n` +
          `Введіть тільки число (наприклад: <code>16000</code>):`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Edit Driver Rate prompt
    if (data === 'edit_driver_rate') {
      await putKV(env, `state:${userId}`, { action: 'await_driver_rate' }, 600);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `📏 <b>Введіть тариф водія за км (грн/км):</b>\n\n` +
          `Поточний тариф: <b>${config.delivery.driver_uah_per_km} грн/км</b>\n` +
          `Введіть число (наприклад: <code>4.5</code> або <code>5</code>):`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Edit Min Tons prompt
    if (data === 'edit_min_tons') {
      await putKV(env, `state:${userId}`, { action: 'await_min_tons' }, 600);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `📦 <b>Введіть мінімальну партію для доставки (тонн):</b>\n\n` +
          `Поточний поріг: <b>${config.delivery.min_tons} т</b>\n` +
          `Введіть число (наприклад: <code>15</code> чи <code>20</code>):`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Cancel input
    if (data === 'cancel_input') {
      await deleteKV(env, `state:${userId}`);
      await callTelegram(token, 'deleteMessage', {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Дію скасовано' });
      return;
    }

    // Create Invite (Owner only)
    if (data === 'create_invite') {
      if (auth.role !== 'owner') {
        await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Тільки для власника', show_alert: true });
        return;
      }
      const tokenStr = `inv_${Math.random().toString(36).substring(2, 10)}`;
      const invites = (await getKV(env, 'auth:invites')) || {};
      invites[tokenStr] = {
        token: tokenStr,
        created_by: userId,
        created_at: new Date().toISOString(),
        role: 'manager'
      };
      await putKV(env, 'auth:invites', invites);

      const botUsername = env.TELEGRAM_BOT_USERNAME || 'ukrecopelleta_bot';
      const inviteUrl = `https://t.me/${botUsername}?start=${tokenStr}`;

      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: `🔗 <b>Персональне посилання-запрошення для нового співробітника:</b>\n\n` +
          `<code>${inviteUrl}</code>\n\n` +
          `📩 Перешліть це повідомлення завідувачу виробництва або менеджеру.\n` +
          `Коли він перейде за посиланням і натисне <b>Start</b>, йому автоматично буде надано доступ до зміни цін та статусу доставки.`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ До головного меню', callback_data: 'back_to_main' }]]
        }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // List Managers (Owner only)
    if (data === 'list_managers') {
      if (auth.role !== 'owner') {
        await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Тільки для власника', show_alert: true });
        return;
      }
      const users = (await getKV(env, 'auth:users')) || {};
      const userList = Object.values(users);

      let text = `👥 <b>Авторизовані користувачі бота:</b>\n\n` +
        `👑 <b>Власник:</b> ID <code>${ownerId}</code>\n\n`;

      const keyboard = [];
      if (userList.length === 0) {
        text += `<i>Додаткових менеджерів поки немає. Створіть посилання через кнопку «Запросити менеджера».</i>`;
      } else {
        text += `<b>Менеджери з доступом до зміни цін:</b>\n`;
        for (const u of userList) {
          const uLabel = u.username ? `@${escapeHtml(u.username)}` : escapeHtml(u.name || `ID ${u.id}`);
          const date = u.added_at ? new Date(u.added_at).toLocaleDateString('uk-UA') : '';
          text += `• ${uLabel} (додано: ${date})\n`;
          keyboard.push([{ text: `❌ Видалити доступ ${u.username ? '@' + u.username : u.id}`, callback_data: `revoke_${u.id}` }]);
        }
      }

      keyboard.push([{ text: '⬅️ До головного меню', callback_data: 'back_to_main' }]);

      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
      await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Revoke Manager (Owner only)
    if (data.startsWith('revoke_')) {
      if (auth.role !== 'owner') {
        await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Тільки для власника', show_alert: true });
        return;
      }
      const targetId = data.replace('revoke_', '');
      const users = (await getKV(env, 'auth:users')) || {};
      const deletedUser = users[targetId];
      delete users[targetId];
      await putKV(env, 'auth:users', users);

      const targetLabel = deletedUser?.username ? `@${deletedUser.username}` : targetId;
      await callTelegram(token, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: `Доступ користувача ${targetLabel} успішно скасовано!`,
        show_alert: true
      });

      // Try to alert the removed user
      try {
        await callTelegram(token, 'sendMessage', {
          chat_id: targetId,
          text: '⛔️ Ваш доступ до панелі керування UkrEcoPelleta було відкликано керівництвом.'
        });
      } catch (_) {}

      // Refresh list
      const menu = renderMainMenu(config, auth.role, userName);
      await callTelegram(token, 'sendMessage', {
        chat_id: cb.message.chat.id,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: menu.keyboard }
      });
      return;
    }
  }

  // 2. Handle Text Messages & Commands
  if (update.message && update.message.text) {
    const msg = update.message;
    const userId = msg.from.id;
    const text = msg.text.trim();
    const userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || 'Менеджер';

    // A. Check for invite token via /start inv_xxx
    if (text.startsWith('/start inv_')) {
      const tokenStr = text.replace('/start ', '').trim();
      const invites = (await getKV(env, 'auth:invites')) || {};

      if (invites[tokenStr]) {
        // Authorize user
        const users = (await getKV(env, 'auth:users')) || {};
        users[userId] = {
          id: userId,
          username: msg.from.username || null,
          name: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || 'Менеджер',
          role: 'manager',
          added_at: new Date().toISOString()
        };
        await putKV(env, 'auth:users', users);
        delete invites[tokenStr];
        await putKV(env, 'auth:invites', invites);

        // Notify new manager
        const config = await getPricingConfig(env);
        const menu = renderMainMenu(config, 'manager', userName);
        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `🎉 <b>Вітаємо! Доступ успішно активовано!</b>\n\nВам надано права менеджера заводу <b>UkrEcoPelleta</b>. Ви можете оперативно оновлювати ціни на сосну, мікс порід та статус доставки на сайті ukrecopelleta.org.\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });

        // Notify Owner
        try {
          await callTelegram(token, 'sendMessage', {
            chat_id: ownerId,
            text: `🔔 <b>Новий співробітник активований!</b>\n\nКористувач ${escapeHtml(userName)} (ID: <code>${userId}</code>) використав запрошення та отримав доступ до зміни цін.`,
            parse_mode: 'HTML'
          });
        } catch (_) {}
        return;
      } else {
        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: '❌ <b>Це посилання-запрошення недійсне або вже було використане.</b>\n\nЗверніться до керівництва за новим запрошенням.',
          parse_mode: 'HTML'
        });
        return;
      }
    }

    // B. Check standard authorization
    const auth = await isAuthorized(env, userId);
    if (!auth.authorized) {
      await callTelegram(token, 'sendMessage', {
        chat_id: msg.chat.id,
        text: `⛔️ <b>Доступ обмежено.</b>\n\nЦей бот призначений виключно для уповноважених співробітників заводу <b>UkrEcoPelleta</b>.\n\nЯкщо ви співробітник заводу, попросіть керівництво надіслати вам персональне посилання-запрошення.`,
        parse_mode: 'HTML'
      });
      return;
    }

    // C. Check pending input state
    const state = await getKV(env, `state:${userId}`);
    if (state && state.action) {
      const numVal = parseFloat(text.replace(',', '.').replace(/\s/g, ''));

      if (state.action === 'await_all_price') {
        if (isNaN(numVal) || numVal < 5000 || numVal > 50000) {
          await callTelegram(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: '⚠️ <b>Будь ласка, введіть реальну ціну в межах від 5 000 до 50 000 грн/т.</b> Спробуйте ще раз або натисніть «Скасувати»:',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]] }
          });
          return;
        }
        await deleteKV(env, `state:${userId}`);
        const newPrice = Math.round(numVal);
        const updated = await savePricingConfig(env, {
          pricing: { pine_uah_per_t: newPrice, acacia_elm_uah_per_t: newPrice }
        }, msg.from);
        const menu = renderMainMenu(updated, auth.role, userName);

        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `✅ <b>Базову ціну для всіх пелет успішно оновлено: ${newPrice.toLocaleString('uk-UA')} грн/т!</b>\n` +
            `Сайт ukrecopelleta.org, калькулятор та Google Search Console оновлено.\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });

        if (auth.role !== 'owner') {
          try {
            await callTelegram(token, 'sendMessage', {
              chat_id: ownerId,
              text: `📢 <b>Менеджер ${escapeHtml(userName)} оновив базову ціну всіх пелет:</b> ${newPrice.toLocaleString('uk-UA')} грн/т`,
              parse_mode: 'HTML'
            });
          } catch (_) {}
        }
        return;
      }

      if (state.action === 'await_pine_price') {
        if (isNaN(numVal) || numVal < 5000 || numVal > 50000) {
          await callTelegram(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: '⚠️ <b>Будь ласка, введіть реальну ціну в межах від 5 000 до 50 000 грн/т.</b> Спробуйте ще раз або натисніть «Скасувати»:',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]] }
          });
          return;
        }
        await deleteKV(env, `state:${userId}`);
        const updated = await savePricingConfig(env, { pricing: { pine_uah_per_t: Math.round(numVal) } }, msg.from);
        const menu = renderMainMenu(updated, auth.role, userName);

        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `✅ <b>Ціну соснових пелет оновлено: ${Math.round(numVal).toLocaleString('uk-UA')} грн/т!</b>\nСайт ukrecopelleta.org вже показує актуальну ціну.\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });

        // Broadcast to Owner if updated by manager
        if (auth.role !== 'owner') {
          try {
            await callTelegram(token, 'sendMessage', {
              chat_id: ownerId,
              text: `📢 <b>Менеджер ${escapeHtml(userName)} оновив ціну сосни:</b> ${Math.round(numVal).toLocaleString('uk-UA')} грн/т`,
              parse_mode: 'HTML'
            });
          } catch (_) {}
        }
        return;
      }

      if (state.action === 'await_acacia_price') {
        if (isNaN(numVal) || numVal < 5000 || numVal > 50000) {
          await callTelegram(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: '⚠️ <b>Будь ласка, введіть реальну ціну в межах від 5 000 до 50 000 грн/т.</b> Спробуйте ще раз:',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]] }
          });
          return;
        }
        await deleteKV(env, `state:${userId}`);
        const updated = await savePricingConfig(env, { pricing: { acacia_elm_uah_per_t: Math.round(numVal) } }, msg.from);
        const menu = renderMainMenu(updated, auth.role, userName);

        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `✅ <b>Ціну міксу (акація+берест) оновлено: ${Math.round(numVal).toLocaleString('uk-UA')} грн/т!</b>\nСайт ukrecopelleta.org вже показує актуальну ціну.\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });
        return;
      }

      if (state.action === 'await_min_delivery') {
        if (isNaN(numVal) || numVal < 1000 || numVal > 100000) {
          await callTelegram(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: '⚠️ <b>Введіть коректну мінімальну суму доставки (від 1 000 до 100 000 грн):</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]] }
          });
          return;
        }
        await deleteKV(env, `state:${userId}`);
        const updated = await savePricingConfig(env, { delivery: { min_delivery_uah: Math.round(numVal) } }, msg.from);
        const menu = renderTariffsMenu(updated);
        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `✅ <b>Мінімальну вартість рейсу доставки оновлено: ${Math.round(numVal).toLocaleString('uk-UA')} грн!</b>\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });
        return;
      }

      if (state.action === 'await_driver_rate') {
        if (isNaN(numVal) || numVal < 1 || numVal > 50) {
          await callTelegram(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: '⚠️ <b>Введіть коректну ставку водія за км (від 1 до 50 грн/км):</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]] }
          });
          return;
        }
        await deleteKV(env, `state:${userId}`);
        const updated = await savePricingConfig(env, { delivery: { driver_uah_per_km: Number(numVal.toFixed(2)) } }, msg.from);
        const menu = renderTariffsMenu(updated);
        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `✅ <b>Ставку водія оновлено: ${numVal.toFixed(2)} грн/км!</b>\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });
        return;
      }

      if (state.action === 'await_min_tons') {
        if (isNaN(numVal) || numVal < 1 || numVal > 50) {
          await callTelegram(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: '⚠️ <b>Введіть мінімальну кількість тонн для доставки (наприклад, 15 чи 22):</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'cancel_input' }]] }
          });
          return;
        }
        await deleteKV(env, `state:${userId}`);
        const updated = await savePricingConfig(env, { delivery: { min_tons: Math.round(numVal) } }, msg.from);
        const menu = renderTariffsMenu(updated);
        await callTelegram(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `✅ <b>Поріг доставки оновлено: від ${Math.round(numVal)} тонн!</b>\n\n` + menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.keyboard }
        });
        return;
      }
    }

    // D. Default /start or /menu command
    const config = await getPricingConfig(env);
    const menu = renderMainMenu(config, auth.role, userName);
    await callTelegram(token, 'sendMessage', {
      chat_id: msg.chat.id,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: menu.keyboard }
    });
  }
}
