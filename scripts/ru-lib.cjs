// Shared helpers for the Russian (/ru/) static pages.
// Ukrainian stays the default language at "/", English is the in-page toggle,
// Russian is the third language and lives only under "/ru/".

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://ukrecopelleta.org';

// Pages that get a Russian copy (commercial pages; legal pages stay Ukrainian).
const PAGES = [
  { file: 'index.html', slug: '' },
  { file: 'pellets.html', slug: 'pellets' },
  { file: 'pelety-nikopol.html', slug: 'pelety-nikopol' },
  { file: 'pelety-dnipro.html', slug: 'pelety-dnipro' },
  { file: 'pelety-optom.html', slug: 'pelety-optom' },
  { file: 'pelety-kryvyi-rih.html', slug: 'pelety-kryvyi-rih' },
  { file: 'pelety-kamianske.html', slug: 'pelety-kamianske' },
  { file: 'pelety-pavlohrad.html', slug: 'pelety-pavlohrad' },
  { file: 'pelety-zaporizhzhia.html', slug: 'pelety-zaporizhzhia' },
  { file: 'pelety-kyiv.html', slug: 'pelety-kyiv' },
  ...require('./data/cities.cjs').cities.map((c) => ({ file: `pelety-${c.slug}.html`, slug: `pelety-${c.slug}` })),
];

const CYR = /[А-Яа-яІіЇїЄєҐґ]/;
const TRANSLATABLE_ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'content', 'data-label', 'data-placeholder'];

// Splits a string into leading whitespace, core text, trailing whitespace.
function trimParts(s) {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return [m[1], m[2], m[3]];
}

// Walks an HTML document and calls fn(text, kind) for every translatable piece.
// fn returns the replacement (or undefined to keep). Returns the rewritten HTML.
function mapHtml(html, fn) {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += mapText(html.slice(i), fn); break; }
    out += mapText(html.slice(i, lt), fn);
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      out += html.slice(lt, end + 3);
      i = end + 3;
      continue;
    }
    const gt = findTagEnd(html, lt);
    let tag = html.slice(lt, gt + 1);
    const name = (tag.match(/^<\/?([a-zA-Z0-9-]+)/) || [])[1];
    const lname = name ? name.toLowerCase() : '';
    tag = mapAttrs(tag, fn);
    out += tag;
    i = gt + 1;
    if (!tag.startsWith('</') && (lname === 'script' || lname === 'style')) {
      const close = html.toLowerCase().indexOf('</' + lname, i);
      let body = html.slice(i, close);
      if (lname === 'script' && /application\/ld\+json/i.test(tag)) body = mapJsonLd(body, fn);
      out += body;
      i = close;
    }
  }
  return out;
}

function findTagEnd(html, lt) {
  let q = null;
  for (let j = lt + 1; j < html.length; j++) {
    const c = html[j];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') return j;
  }
  return html.length - 1;
}

function mapText(text, fn) {
  if (!CYR.test(text)) return text;
  const [a, core, b] = trimParts(text);
  const r = fn(core, 'text');
  return r === undefined ? text : a + r + b;
}

function mapAttrs(tag, fn) {
  return tag.replace(/\s([a-zA-Z-:]+)=("([^"]*)"|'([^']*)')/g, (m, attr, _q, dq, sq) => {
    const v = dq !== undefined ? dq : sq;
    if (!TRANSLATABLE_ATTRS.includes(attr.toLowerCase()) || !CYR.test(v)) return m;
    const r = fn(v.trim(), 'attr');
    if (r === undefined) return m;
    const quote = dq !== undefined ? '"' : "'";
    return ` ${attr}=${quote}${r.replace(new RegExp(quote, 'g'), quote === '"' ? '&quot;' : '&#39;')}${quote}`;
  });
}

function mapJsonLd(body, fn) {
  let data;
  try { data = JSON.parse(body); } catch { return body; }
  const walk = (v) => {
    if (typeof v === 'string') {
      if (!CYR.test(v)) return v;
      const r = fn(v.trim(), 'json');
      return r === undefined ? v : r;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) v[k] = walk(v[k]);
    }
    return v;
  };
  return '\n' + JSON.stringify(walk(data), null, 2) + '\n';
}

module.exports = { ROOT, SITE, PAGES, CYR, mapHtml };
