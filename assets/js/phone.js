/**
 * Phone numbers in the quote form: one parser for the browser (window.LeadPhone) and /api/lead (import).
 *
 * A number typed with "+" or "00" is international: the country is read from its calling code and the form
 * shows that country's flag. A number without either is Ukrainian, written any of the usual ways
 * (099…, 80 99…, 380…, +38 (099)…, +380 0 99…), and is corrected to +380 99 123 45 67.
 * Junk is refused: letters, wrong length for the country, a number Ukraine doesn't issue, 0000000.
 *
 * Lengths are the national significant number (no trunk 0) per the ITU numbering plans. A calling code
 * that isn't listed is accepted on the E.164 length alone (8–15 digits) and shown without a flag.
 */

// [calling code, ISO country, min length, max length, first digits allowed]
const COUNTRIES = [
  ['380', 'UA', 9, 9, /^[3-9]/],
  ['371', 'LV', 8, 8, /^[2689]/], ['370', 'LT', 8, 8], ['372', 'EE', 7, 8],
  ['48', 'PL', 9, 9], ['373', 'MD', 8, 8], ['40', 'RO', 9, 9], ['36', 'HU', 8, 9],
  ['421', 'SK', 9, 9], ['420', 'CZ', 9, 9], ['49', 'DE', 6, 13], ['43', 'AT', 7, 13],
  ['41', 'CH', 9, 9], ['33', 'FR', 9, 9], ['34', 'ES', 9, 9], ['39', 'IT', 6, 11],
  ['351', 'PT', 9, 9], ['44', 'GB', 9, 10], ['353', 'IE', 7, 9], ['31', 'NL', 9, 9],
  ['32', 'BE', 8, 9], ['352', 'LU', 6, 11], ['45', 'DK', 8, 8], ['46', 'SE', 7, 10],
  ['47', 'NO', 8, 8], ['358', 'FI', 6, 11], ['354', 'IS', 7, 9], ['359', 'BG', 7, 9],
  ['30', 'GR', 10, 10], ['90', 'TR', 10, 10], ['385', 'HR', 8, 9], ['386', 'SI', 8, 8],
  ['381', 'RS', 7, 10], ['387', 'BA', 8, 9], ['382', 'ME', 8, 8], ['389', 'MK', 8, 8],
  ['355', 'AL', 8, 9], ['383', 'XK', 8, 8], ['356', 'MT', 8, 8], ['357', 'CY', 8, 8],
  ['375', 'BY', 9, 9], ['995', 'GE', 9, 9], ['374', 'AM', 8, 8], ['994', 'AZ', 9, 9],
  ['998', 'UZ', 9, 9], ['996', 'KG', 9, 9], ['992', 'TJ', 9, 9], ['993', 'TM', 8, 8],
  ['1', 'US', 10, 10, /^[2-9]/], ['972', 'IL', 8, 9], ['971', 'AE', 8, 9], ['966', 'SA', 8, 9],
  ['974', 'QA', 8, 8], ['20', 'EG', 9, 10], ['212', 'MA', 9, 9], ['27', 'ZA', 9, 9],
  ['86', 'CN', 9, 11], ['91', 'IN', 10, 10], ['81', 'JP', 9, 10], ['82', 'KR', 8, 10],
  ['61', 'AU', 9, 9], ['64', 'NZ', 8, 10], ['55', 'BR', 10, 11], ['52', 'MX', 10, 10],
  ['54', 'AR', 10, 10],
];
// +7 is shared: Kazakhstan numbers start with 6 or 7. Other +7 numbers are accepted without a flag.
const SHARED = { '7': { min: 10, max: 10, iso: (n) => (/^[67]/.test(n) ? 'KZ' : null) } };
const BY_CODE = new Map(COUNTRIES.map(([cc, iso, min, max, lead]) => [cc, { iso, min, max, lead }]));
const KEEPS_ZERO = new Set(['39']); // Italian landlines keep their leading 0 after +39

function lookup(digits) {
  for (const len of [3, 2, 1]) {
    const cc = digits.slice(0, len);
    if (BY_CODE.has(cc)) return { cc, ...BY_CODE.get(cc) };
    if (SHARED[cc]) return { cc, ...SHARED[cc], shared: true };
  }
  return null;
}

// 0000000, 1111111, 1234567…, 9876543…: typed to get past the form
function looksFake(n) {
  if (n.length < 7) return false;
  if (/^(\d)\1+$/.test(n)) return true;
  return '01234567890'.includes(n) || '09876543210'.includes(n);
}

function group(n) {
  if (n.length <= 4) return n;
  if (n.length === 7) return `${n.slice(0, 3)} ${n.slice(3)}`;
  if (n.length === 8) return `${n.slice(0, 4)} ${n.slice(4)}`;
  if (n.length === 10) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  return n.match(/.{1,3}/g).join(' ');
}

function display(cc, n) {
  if (cc === '380') return `+380 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  return `+${cc} ${group(n)}`;
}

function intl(digits) {
  const c = lookup(digits);
  if (!c) {
    const ok = /^[1-9]\d{7,14}$/.test(digits) && !looksFake(digits.slice(3));
    return { valid: ok, reason: ok ? null : digits.length < 8 ? 'short' : digits.length > 15 ? 'long' : 'pattern', iso: null, cc: null,
      nat: digits, e164: `+${digits}`, display: `+${digits}` };
  }
  let n = digits.slice(c.cc.length);
  // "+380 0XX…", "+44 07…": the trunk 0 is dialled only inside the country
  if (n.startsWith('0') && !KEEPS_ZERO.has(c.cc) && n.length > c.min) n = n.slice(1);
  const iso = c.shared ? c.iso(n) : c.iso;
  const base = { iso, cc: c.cc, nat: n, e164: `+${c.cc}${n}`, display: display(c.cc, n) };
  if (!n) return { ...base, valid: false, reason: 'short' };
  if (n.length < c.min) return { ...base, valid: false, reason: 'short' };
  if (n.length > c.max) return { ...base, valid: false, reason: 'long' };
  if ((c.lead && !c.lead.test(n)) || looksFake(n)) return { ...base, valid: false, reason: 'pattern' };
  return { ...base, valid: true, reason: null };
}

// Ukrainian number written without "+" or "00": returns the 9-digit national number, or null
function ukrainian(d) {
  let m;
  if ((m = d.match(/^3800?(\d{9})$/))) return m[1]; // 380 99…, 380 099…
  if ((m = d.match(/^80(\d{9})$/))) return m[1];    // 8 099…, the old long-distance prefix
  if ((m = d.match(/^0(\d{9})$/))) return m[1];     // 099…
  if (/^\d{9}$/.test(d)) return d;                  // 99…, the leading 0 left off
  return null;
}

/**
 * parsePhone('0037126133794') → { valid: true, iso: 'LV', cc: '371', e164: '+37126133794', display: '+371 2613 3794', … }
 * reason when invalid: empty | chars | short | long | pattern | needPlus (then `suggestion` holds the fix)
 */
export function parsePhone(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { valid: false, reason: 'empty', raw };
  const s = raw.replace(/[\s().\-‐–—/]/g, '');
  if (!/^\+?\d+$/.test(s)) return { valid: false, reason: 'chars', raw };

  let out;
  // "+099…": a Ukrainian number with a stray "+" (no calling code starts with 0)
  const strayPlus = /^\+0[1-9]/.test(s) && ukrainian(s.slice(1));
  if (strayPlus) {
    out = intl(`380${strayPlus}`);
  } else if (s.startsWith('+') || /^00[1-9]/.test(s)) {
    out = intl(s.replace(/^\+|^00/, '').replace(/^0+/, ''));
  } else {
    const n = ukrainian(s);
    if (n) {
      out = intl(`380${n}`);
    } else {
      out = { valid: false, reason: s.length < 10 ? 'short' : 'long', iso: 'UA' };
      // 37126133794 or 4915112345678: a foreign number with the "+" left off
      const guess = intl(s);
      if (guess.valid && guess.iso) Object.assign(out, { reason: 'needPlus', iso: null, suggestion: guess });
    }
  }
  out.raw = raw;
  out.corrected = !!out.valid && out.display.replace(/\s/g, '') !== s.replace(/^00/, '+');
  return out;
}

const MESSAGES = {
  empty: ['Вкажіть номер телефону.', 'Enter your phone number.'],
  chars: ['У номері мають бути лише цифри (та «+» на початку).', 'Use digits only, with "+" at the start for a foreign number.'],
  short: ['У номері не вистачає цифр.', 'The number is missing digits.'],
  long: ['У номері забагато цифр.', 'The number has too many digits.'],
  pattern: ['Такого номера не існує. Перевірте цифри.', 'This number does not exist. Check the digits.'],
  needPlus: ['Це іноземний номер? Додайте «+» на початку.', 'A foreign number? Add "+" at the start.'],
};

export function phoneMessage(result, lang) {
  const m = MESSAGES[result.reason] || MESSAGES.pattern;
  const en = lang === 'en';
  if (result.iso === 'UA' && (result.reason === 'short' || result.reason === 'long')) {
    return en ? 'A Ukrainian number has 10 digits: 099 123 45 67.' : 'Український номер має 10 цифр: 099 123 45 67.';
  }
  return en ? m[1] : m[0];
}

export function countryName(iso, lang) {
  if (!iso) return '';
  try {
    return new Intl.DisplayNames([lang === 'en' ? 'en' : 'uk'], { type: 'region' }).of(iso) || iso;
  } catch (e) {
    return iso;
  }
}

if (typeof window !== 'undefined') window.LeadPhone = { parsePhone, phoneMessage, countryName };
