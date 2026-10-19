// assets/js/phone.js: what the quote form accepts, corrects and refuses. Run: node scripts/phone.test.mjs
import { parsePhone, phoneMessage, countryName } from '../assets/js/phone.js';

// [input, expected e164 or null when refused, expected flag, expected reason when refused]
const cases = [
  // The Latvian buyer of 19.10.2026 typed the international "00" prefix
  ['0037126133794', '+37126133794', 'LV'],
  ['+371 26 133 794', '+37126133794', 'LV'],
  ['37126133794', null, null, 'needPlus'],
  // Ukrainian numbers, the ways people write them
  ['099 123 45 67', '+380991234567', 'UA'],
  ['0991234567', '+380991234567', 'UA'],
  ['(099) 123-45-67', '+380991234567', 'UA'],
  ['80991234567', '+380991234567', 'UA'],
  ['380991234567', '+380991234567', 'UA'],
  ['+380991234567', '+380991234567', 'UA'],
  ['+38 (099) 123-45-67', '+380991234567', 'UA'],
  ['+380 099 123 45 67', '+380991234567', 'UA'],
  ['3800991234567', '+380991234567', 'UA'],
  ['00380991234567', '+380991234567', 'UA'],
  ['+0991234567', '+380991234567', 'UA'],
  ['991234567', '+380991234567', 'UA'],
  ['+380 566 61 23 45', '+380566612345', 'UA'], // Nikopol landline
  // Other countries
  ['+48 512 345 678', '+48512345678', 'PL'],
  ['+49 151 23456789', '+4915123456789', 'DE'],
  ['+44 07911 123456', '+447911123456', 'GB'],
  ['+373 69 123 456', '+37369123456', 'MD'],
  ['+1 212 555 0147', '+12125550147', 'US'],
  ['+7 701 234 5678', '+77012345678', 'KZ'],
  ['+39 06 1234 5678', '+390612345678', 'IT'],
  // Junk
  ['', null, null, 'empty'],
  ['123', null, null, 'short'],
  ['099 123 45', null, null, 'short'],
  ['099123456789', null, null, 'long'],
  ['дзвоніть', null, null, 'chars'],
  ['099 123 45 67 Олег', null, null, 'chars'],
  ['0000000000', null, null, 'pattern'],
  ['+380 00 000 00 00', null, null, 'pattern'],
  ['+380 12 345 67 89', null, null, 'pattern'],
  ['+371 1234 5678', null, null, 'pattern'],
  ['+371 2613 379', null, null, 'short'],
  ['+48 51234567890', null, null, 'long'],
  ['+1 012 555 0147', null, null, 'pattern'],
];

let fails = 0;
for (const [input, e164, iso, reason] of cases) {
  const r = parsePhone(input);
  const pass = e164 ? r.valid && r.e164 === e164 && r.iso === iso : !r.valid && r.reason === reason;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(input)} -> ${r.valid ? `${r.display} (${r.iso})` : `refused: ${r.reason}`}`);
}

const checks = [
  ['Ukrainian display format', parsePhone('0991234567').display === '+380 99 123 45 67'],
  ['missing "+" suggests the Latvian number', parsePhone('37126133794').suggestion?.e164 === '+37126133794'],
  ['corrected flag set when the form rewrites the number', parsePhone('0991234567').corrected && !parsePhone('+380 99 123 45 67').corrected],
  ['Ukrainian length message', phoneMessage(parsePhone('099 123 45'), 'uk').includes('10 цифр')],
  ['country name in Ukrainian', countryName('LV', 'uk') === 'Латвія'],
];
for (const [name, ok] of checks) {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
if (fails) process.exit(1);
