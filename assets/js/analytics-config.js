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

  // 5. Prices, UAH per tonne, ex-warehouse Nikopol (set by the owner, Sep 2026).
  // Keep the JSON-LD "lowPrice"/"highPrice"/"priceRange" and the FAQ price answers on the pages in step.
  PRICING: {
    pine_uah_per_t: 14500,
    acacia_elm_uah_per_t: 14500
  },

  // 5b. Delivery cost model used by the calculator: fuel + driver pay, own trucks.
  //   per truck: fuel = km × (loaded + empty return consumption) / 100 × (diesel price + diesel_markup)
  //              driver = 2 × km × driver rate
  //   trucks = ceil(big bags / bags_per_truck); big bags = tonnes × 1000 / bag_kg
  //   per order: never less than min_delivery_uah (set by the owner, Sep 2026)
  // The diesel price itself comes from /data/fuel.json, updated daily by .github/workflows/fuel-price.yml;
  // diesel_uah_per_l below is only the fallback if that file can't be read.
  // Road distances for every settlement are in /assets/data/places.json (scripts/build-places.cjs).
  DELIVERY: {
    diesel_uah_per_l: 98.42,         // fallback: avg ДП at Ukrainian filling stations, Minfin 25.09.2026
    diesel_date: '2026-09-25',
    diesel_markup_uah_per_l: 3,      // added to the national average: the cheap stations are not on every route (owner, Sep 2026)
    consumption_loaded_l_per_100km: 35, // 20–22 t curtain-sider, loaded (market range 32–38)
    consumption_empty_l_per_100km: 28,  // same truck returning empty
    driver_uah_per_km: 4,            // ~40 000 UAH/month at ~10 000 km (owner, Sep 2026)
    bag_kg: 650,                     // one big bag of pellets (owner, Sep 2026)
    bags_per_truck: 26,              // 13.6 m curtain-sider, one tier: 26 × 650 kg = 16.9 t
    min_delivery_uah: 15000,         // minimum delivery charge per order (owner, Sep 2026)
    // Road km from the warehouse for the ?city= links on the city pages (same values as places.json),
    // so the calculator shows a price before places.json has loaded
    distances_km: {
      nikopol_deliv: 4,
      pokrov: 23,
      marhanets: 31,
      kryvyi_rih: 100,
      dnipro: 125,
      kamianske: 150,
      novomoskovsk: 151, // Самар
      pavlohrad: 200
    }
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
