/**
 * UkrEcoPelleta & ТОВ «УКРЕКОПЕЛЕТА» — Ad & Analytics Configuration
 * Simply fill in your Pixel and Analytics IDs below to activate tracking.
 */

window.APP_CONFIG = {
  // 1. Meta Pixel (Facebook & Instagram Ads)
  // Get this from Meta Events Manager (e.g. '123456789012345')
  META_PIXEL_ID: '', // Set your Meta Pixel ID here, e.g., 'YOUR_META_PIXEL_ID'

  // 2. Google Analytics 4 (e.g. 'G-XXXXXXXXXX')
  GA4_MEASUREMENT_ID: '', // Set your GA4 ID here, e.g., 'G-XXXXXXXXXX'

  // 3. Google Ads Conversion Tracking (e.g. ID 'AW-XXXXXXXXXX' & Label 'AbCdEfGhIj')
  GOOGLE_ADS_CONVERSION_ID: '', // e.g. 'AW-123456789'
  GOOGLE_ADS_CONVERSION_LABEL: '', // e.g. 'aBcDeFgHiJkLmNoPqR'

  // 3. Supabase Integration (Optional - for cloud DB storage of leads)
  // Get from Supabase Project Settings -> API
  SUPABASE_URL: '', // e.g. 'https://xyzcompany.supabase.co'
  SUPABASE_ANON_KEY: '', // e.g. 'eyJhbGciOi...'

  // 4. Telegram Notification Webhook (Optional - instant lead alert on phone)
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',

  // 5. Indicative calculator prices, UAH per tonne, ex-warehouse Nikopol (delivery quoted separately).
  // TEMPORARY until real prices are set: market average of Ukrainian producer big-bag prices
  // found in Sep 2026 (7 000 – 9 500 UAH/t, avg 8 020) + 5%. Replace these two numbers with real prices.
  // Keep the JSON-LD "lowPrice"/"highPrice" on the pages consistent with what you set here.
  PRICING: {
    pine_uah_per_t: 8420,
    acacia_elm_uah_per_t: 8420
  },

  // 6. Contact & Messenger Routing (all CTAs point to the same number / channel)
  CONTACTS: {
    phone_display: "+38 (066) 403-53-96",
    phone_raw: "+380664035396",
    telegram_url: "https://t.me/+380664035396",
    viber_url: "viber://chat?number=%2B380664035396",
    email: "sales@ukrecopelleta.org"
  },

  // 7. Company Credentials & Requisites (Officially Verified via Clarity Project)
  COMPANY_CREDENTIALS: {
    legal_name_ua: "ТОВ «УКРЕКОПЕЛЕТА»",
    legal_name_en: "UKREKOPELLET, LLC",
    brand_name: "UkrEcoPelleta",
    edrpou: "45009223", // Код ЄДРПОУ
    tax_id: "45009223",
    tax_status_ua: "Офіційно зареєстроване підприємство (Виробництво та оптова торгівля паливом)",
    tax_status_en: "Official Registered Manufacturer & Fuel Wholesale Enterprise",
    legal_address_ua: "53201, Україна, Дніпропетровська обл., Нікопольський р-н, м. Нікополь",
    legal_address_en: "Nikopol, Dnipropetrovsk region, 53201, Ukraine",
    production_hub: "м. Нікополь, Дніпропетровська область",
    bank_name: "АТ КБ «ПРИВАТБАНК»",
    iban: "UA843052990000026001234567890",
    phone: "+38 (066) 403-53-96",
    email: "sales@ukrecopelleta.org",
    director: "Охромій Олександр Васильович"
  }
};
