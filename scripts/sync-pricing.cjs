#!/usr/bin/env node
/**
 * UkrEcoPelleta — System-Wide Pricing & SEO Synchronization Tool
 * Synchronizes live pricing from data/pricing.json across:
 * 1. Schema.org JSON-LD structured data (Search Console / Rich Snippets: AggregateOffer, UnitPriceSpecification, FAQPage)
 * 2. Meta tags (<meta name="description">, og:description)
 * 3. Static HTML prices (<dd><strong>, lead paragraphs, bullet points, FAQ blocks)
 * 4. analytics-config.js (Google Ads & Meta Pixel conversion tracking defaults)
 * 5. data/ru/translations.json & ru/*.html layout sync
 * 6. llms.txt & llms-full.txt (AI Search engines: ChatGPT, Gemini, Perplexity)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRICING_FILE = path.join(ROOT, 'data', 'pricing.json');

if (!fs.existsSync(PRICING_FILE)) {
  console.error('data/pricing.json not found!');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(PRICING_FILE, 'utf8'));
const pinePrice = Number(config.pricing?.pine_uah_per_t) || 14500;
const acaciaPrice = Number(config.pricing?.acacia_elm_uah_per_t) || pinePrice;
const minDelivery = Number(config.delivery?.min_delivery_uah) || 15000;
const driverRate = Number(config.delivery?.driver_uah_per_km) || 4;

const fmtUa = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const priceFmt = fmtUa(pinePrice); // e.g. "15 500"

console.log(`Syncing system-wide pricing: ${pinePrice} UAH/t (formatted: "${priceFmt}")...`);

// 1. Update analytics-config.js
const cfgPath = path.join(ROOT, 'assets', 'js', 'analytics-config.js');
if (fs.existsSync(cfgPath)) {
  let cfgContent = fs.readFileSync(cfgPath, 'utf8');
  cfgContent = cfgContent.replace(/pine_uah_per_t:\s*\d+/, `pine_uah_per_t: ${pinePrice}`);
  cfgContent = cfgContent.replace(/acacia_elm_uah_per_t:\s*\d+/, `acacia_elm_uah_per_t: ${acaciaPrice}`);
  cfgContent = cfgContent.replace(/min_delivery_uah:\s*\d+/, `min_delivery_uah: ${minDelivery}`);
  cfgContent = cfgContent.replace(/driver_uah_per_km:\s*[\d.]+/, `driver_uah_per_km: ${driverRate}`);
  fs.writeFileSync(cfgPath, cfgContent, 'utf8');
  console.log('✓ Updated analytics-config.js');
}

// 2. Update llms.txt and llms-full.txt
for (const txtFile of ['llms.txt', 'llms-full.txt']) {
  const p = path.join(ROOT, txtFile);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/(Ціна[\s\S]*?):\s*[\d\s]+грн за тонну/i, `$1: ${priceFmt} грн за тонну`);
    content = content.replace(/14\s*500\s*грн/g, `${priceFmt} грн`);
    fs.writeFileSync(p, content, 'utf8');
    console.log(`✓ Updated ${txtFile}`);
  }
}

// 3. Update data/ru/translations.json so Russian mirrors stay 100% in step
const ruTransPath = path.join(ROOT, 'data', 'ru', 'translations.json');
if (fs.existsSync(ruTransPath)) {
  let ruJson = fs.readFileSync(ruTransPath, 'utf8');
  ruJson = ruJson.replace(/(\b\d{2}\s\d{3}\b)(?=\s*грн)/g, priceFmt);
  const minPrice = Math.min(pinePrice, acaciaPrice);
  const minFmt = fmtUa(minPrice);
  const ruObj = JSON.parse(ruJson);
  ruObj[`від ${minFmt}`] = `от ${minFmt}`;
  ruObj[`від ${priceFmt}`] = `от ${priceFmt}`;
  ruObj[priceFmt] = priceFmt;
  fs.writeFileSync(ruTransPath, JSON.stringify(ruObj, null, 2).replace(/\r\n/g, '\n'), 'utf8');
  console.log('✓ Updated data/ru/translations.json');
}

// 4. Update all root HTML files
const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let updatedHtmlCount = 0;
for (const relPath of htmlFiles) {
  const fullPath = path.join(ROOT, relPath);
  let html = fs.readFileSync(fullPath, 'utf8');
  const original = html;

  // A. Schema.org JSON-LD
  const minP = Math.min(pinePrice, acaciaPrice);
  const maxP = Math.max(pinePrice, acaciaPrice);
  const rangeStr = minP === maxP ? `${minP} UAH/t` : `${minP}–${maxP} UAH/t`;
  html = html.replace(/"lowPrice":\s*"\d+"/g, `"lowPrice": "${minP}"`);
  html = html.replace(/"highPrice":\s*"\d+"/g, `"highPrice": "${maxP}"`);
  html = html.replace(/"priceRange":\s*"[^"]*"/g, `"priceRange": "${rangeStr}"`);
  html = html.replace(/("priceSpecification":\s*\{\s*"@type":\s*"UnitPriceSpecification",\s*"price":\s*)"\d+"/g, `$1"${minP}"`);

  // B. FAQ Schema JSON-LD text
  html = html.replace(/(Ціна[^":]*?[—:]\s*)[\d\s]+(грн за тонну)/gi, `$1${priceFmt} $2`);

  // C. Meta description & content text prices
  html = html.replace(/(\b\d{2}\s\d{3}\b)(?=\s*грн(?:\/т|\s*за\s*тонну)?)/gi, priceFmt);

  // D2. Price in its own element (the words around it are translated by i18n.js), e.g. the home FAQ
  html = html.replace(/(<span data-dynamic-price="pine">)[^<]*(<\/span>)/g, `$1${priceFmt}$2`);

  // D. Static HTML Visual Content
  html = html.replace(/(<dd><strong[^>]*>)[^<]+(<\/strong>\s*<span[^>]*data-i18n="facts\.price_unit")/gi, `$1${priceFmt}$2`);

  if (html !== original) {
    fs.writeFileSync(fullPath, html.replace(/\r\n/g, '\n'), 'utf8');
    updatedHtmlCount++;
  }
}

// 5. Re-run sync-layout.cjs to rebuild Russian pages (/ru/) and align layout
console.log('Synchronizing layout & Russian translations (/ru/)...');
execSync('node scripts/sync-layout.cjs', { cwd: ROOT, stdio: 'inherit' });

console.log(`✓ Synchronized ${updatedHtmlCount} HTML landing pages for Search Console & Rich Snippets.`);
console.log('✓ System-wide pricing synchronization complete.');
