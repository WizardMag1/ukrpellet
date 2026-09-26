// One-command SEO/site integrity check: `npm run check`
// Validates every page listed in sitemap.xml plus repo-wide stale-domain scan.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://ukrecopelleta.org';
const STALE = ['ocrecopiliata', 'ukrpellet.ua', 'ukrecopeleta.com.ua', 'ia-tems.com', 'iatems.ua'];
const SCAN_EXT = ['.html', '.js', '.txt', '.xml', '.json', '.webmanifest'];
const SKIP_DIRS = ['node_modules', '.git', 'docs', 'scripts', '.vercel'];

const errors = [];
const fail = (msg) => errors.push(msg);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// URL path -> file on disk ("/" -> index.html, "/pellets" -> pellets.html)
const fileFor = (urlPath) => (urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '') + '.html');

// 1. Sitemap <-> files
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const pages = [];
for (const loc of locs) {
  if (!loc.startsWith(DOMAIN)) { fail(`sitemap: ${loc} is not on ${DOMAIN}`); continue; }
  const urlPath = loc.slice(DOMAIN.length) || '/';
  const file = fileFor(urlPath);
  if (!fs.existsSync(path.join(ROOT, file))) fail(`sitemap: ${loc} -> missing ${file}`);
  else pages.push({ file, urlPath, loc });
}
const publicHtml = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
for (const f of publicHtml) {
  if (!pages.some((p) => p.file === f)) fail(`${f}: public page not listed in sitemap.xml`);
}

// 2. Per-page checks
const count = (html, re) => (html.match(re) || []).length;
for (const { file, loc } of pages) {
  const html = read(file);

  if (count(html, /<title>/gi) !== 1) fail(`${file}: must have exactly one <title>`);
  const desc = html.match(/<meta name="description" content="([^"]*)"/i);
  if (!desc) fail(`${file}: missing meta description`);
  else if (desc[1].length > 160) fail(`${file}: meta description is ${desc[1].length} chars (max 160)`);
  if (count(html, /<h1[\s>]/gi) !== 1) fail(`${file}: must have exactly one <h1>`);

  const canon = html.match(/<link rel="canonical" href="([^"]+)"/i);
  if (!canon) fail(`${file}: missing canonical`);
  else if (canon[1] !== loc) fail(`${file}: canonical ${canon[1]} != sitemap ${loc}`);

  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].forEach((m, i) => {
    try { JSON.parse(m[1]); } catch (e) { fail(`${file}: JSON-LD block #${i + 1}: ${e.message}`); }
  });

  // Internal links: href="/x", "x.html", "assets/..." must resolve to a file
  for (const [, href] of html.matchAll(/href="([^"#?]+)[^"]*"/g)) {
    if (/^(https?:|mailto:|tel:|viber:|tg:|\/\/|javascript:)/.test(href)) continue;
    const clean = href.replace(/^\//, '');
    const target = clean === '' ? 'index.html' : clean;
    const exists = fs.existsSync(path.join(ROOT, target)) || fs.existsSync(path.join(ROOT, target + '.html'));
    if (!exists) fail(`${file}: broken internal link ${href}`);
  }
}

// 3. Stale domains anywhere in shipped files
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  if (d.isDirectory()) return SKIP_DIRS.includes(d.name) ? [] : walk(path.join(dir, d.name));
  return SCAN_EXT.includes(path.extname(d.name)) ? [path.join(dir, d.name)] : [];
});
for (const f of walk(ROOT)) {
  const text = fs.readFileSync(f, 'utf8');
  for (const s of STALE) if (text.includes(s)) fail(`${path.relative(ROOT, f)}: stale reference "${s}"`);
}

if (errors.length) {
  console.error(errors.map((e) => '✗ ' + e).join('\n'));
  console.error(`\n${errors.length} problem(s) across ${pages.length} pages.`);
  process.exit(1);
}
console.log(`✓ SEO check passed: ${pages.length} pages, sitemap, canonicals, JSON-LD, links, domains.`);
