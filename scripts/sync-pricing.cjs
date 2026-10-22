#!/usr/bin/env node
/**
 * UkrEcoPelleta — System-Wide Pricing & SEO Synchronization Tool
 * Synchronizes live pricing from data/pricing.json across:
 * 1. Schema.org JSON-LD structured data (Search Console / Rich Snippets: AggregateOffer, UnitPriceSpecification, FAQPage)
 * 2. Meta tags (<meta name="description">, og:description)
 * 3. Static HTML prices (<dd><strong>, lead paragraphs, bullet points, FAQ blocks)
 * 4. analytics-config.js (Google Ads & Meta Pixel conversion tracking defaults)
 * 5. llms.txt & llms-full.txt (AI Search engines: ChatGPT, Gemini, Perplexity)
 */

const fs = require('fs');
const path = require('path');

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

// 3. Update all HTML files (Root + ru/)
const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const ruDir = path.join(ROOT, 'ru');
if (fs.existsSync(ruDir)) {
  fs.readdirSync(ruDir).filter(f => f.endsWith('.html')).forEach(f => htmlFiles.push(path.join('ru', f)));
}

let updatedHtmlCount = 0;
for (const relPath of htmlFiles) {
  const fullPath = path.join(ROOT, relPath);
  let html = fs.readFileSync(fullPath, 'utf8');
  const original = html;

  // A. Schema.org JSON-LD
  // "lowPrice": "14500" -> "lowPrice": "15500"
  html = html.replace(/"lowPrice":\s*"\d+"/g, `"lowPrice": "${pinePrice}"`);
  html = html.replace(/"highPrice":\s*"\d+"/g, `"highPrice": "${pinePrice}"`);
  html = html.replace(/"priceRange":\s*"\d+\s*UAH\/t"/g, `"priceRange": "${pinePrice} UAH/t"`);
  html = html.replace(/("priceSpecification":\s*\{\s*"@type":\s*"UnitPriceSpecification",\s*"price":\s*)"\d+"/g, `$1"${pinePrice}"`);

  // B. FAQ Schema JSON-LD text:
  // "text": "Ціна: 14 500 грн за тонну..." -> "... 15 500 грн ..."
  html = html.replace(/(Ціна[^":]*?[—:]\s*)[\d\s]+(грн за тонну)/gi, `$1${priceFmt} $2`);
  html = html.replace(/(Цена[^":]*?[—:]\s*)[\d\s]+(грн за тонну|грн\/т)/gi, `$1${priceFmt} $2`);

  // C. Meta description
  html = html.replace(/(від|от|ціна|цена|—)\s*[\d\s]+(грн\/т|грн за тонну)/gi, (match, prefix, suffix) => {
    return `${prefix} ${priceFmt} ${suffix}`;
  });

  // D. Static HTML Visual Content
  // <dd><strong>14 500</strong> <span data-i18n="facts.price_unit">грн/т...</span></dd>
  html = html.replace(/(<dd><strong>)[\d\s]+(<\/strong>\s*<span[^>]*data-i18n="facts\.price_unit")/gi, `$1${priceFmt}$2`);

  // Paragraphs & lists
  html = html.replace(/(<li>)[\d\s]+(грн\/т на складі)/gi, `$1${priceFmt} $2`);
  html = html.replace(/(<li>)[\d\s]+(грн\/т на складе)/gi, `$1${priceFmt} $2`);

  if (html !== original) {
    fs.writeFileSync(fullPath, html, 'utf8');
    updatedHtmlCount++;
  }
}

console.log(`✓ Synchronized ${updatedHtmlCount} HTML landing pages for Search Console & Rich Snippets.`);
console.log('✓ System-wide pricing synchronization complete.');
