#!/usr/bin/env node
// wrangler.toml (repo root, used by Cloudflare Workers Builds) and cloudflare/wrangler.toml must describe
// the same Worker. Only the entry path differs, because the root config points into cloudflare/.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const settings = (file, main) => fs.readFileSync(path.join(ROOT, file), 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('#'))
  .map((l) => (l.startsWith('main = ') ? (l === `main = "${main}"` ? 'main' : `BAD ${l}`) : l))
  .join('\n');
const a = settings('wrangler.toml', 'cloudflare/worker.js');
const b = settings('cloudflare/wrangler.toml', 'worker.js');
if (a !== b) {
  console.error('✗ wrangler.toml and cloudflare/wrangler.toml differ. Keep them in step:');
  const al = a.split('\n'), bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) if (al[i] !== bl[i]) console.error(`  root: ${al[i] ?? '(none)'}\n  cloudflare/: ${bl[i] ?? '(none)'}`);
  process.exit(1);
}
console.log('✓ wrangler.toml matches cloudflare/wrangler.toml');
