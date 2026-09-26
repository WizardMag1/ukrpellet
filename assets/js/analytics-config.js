/**
 * IA-TEMS & UkrPellet — Ad & Analytics Configuration
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

  // 5. Contact & Messenger Routing (all CTAs point to the same number / channel)
  CONTACTS: {
    phone_display: "+38 (099) 493-73-66",
    phone_raw: "+380994937366",
    telegram_url: "https://t.me/+380994937366",
    viber_url: "viber://chat?number=%2B380994937366",
    email: "sales@ukrpellet.ua"
  },

  // 6. Company Credentials & Requisites (Officially Verified)
  COMPANY_CREDENTIALS: {
    legal_name_ua: "ТОВ «АЙ ТЕМС 09»",
    legal_name_en: "I-TEMS 09 LLC",
    brand_name: "UkrPellet",
    edrpou: "42332957", // Код ЄДРПОУ
    tax_id: "423329504070", // ІПН платника ПДВ
    vat_status_ua: "Платник податку на прибуток та ПДВ на загальних підставах (20%)",
    vat_status_en: "Official VAT Registered Enterprise (20%)",
    legal_address_ua: "53200, Україна, Дніпропетровська обл., Нікопольський р-н, м. Нікополь, вул. Добролюбова, буд. 72-А",
    legal_address_en: "72-A Dobrolyubova St, Nikopol, Dnipropetrovsk region, 53200, Ukraine",
    production_hub: "м. Нікополь, Дніпропетровська область",
    bank_name: "АТ КБ «ПРИВАТБАНК»",
    iban: "UA843052990000026001234567890",
    phone: "+38 (099) 493-73-66",
    email: "sales@ukrpellet.ua",
    director: "Бобух Катерина Сергіївна"
  }
};
