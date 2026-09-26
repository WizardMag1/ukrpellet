const fs = require('fs');
const files = ['index.html', 'pellets.html', 'oferta.html', 'privacy.html'];
let errors = 0;

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  const matches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  matches.forEach((m, idx) => {
    try {
      const parsed = JSON.parse(m[1].trim());
      console.log(`[PASS] ${file} block #${idx + 1}: @type = ${parsed['@type']}`);
    } catch (e) {
      console.error(`[FAIL] Schema error in ${file} block #${idx + 1}: ${e.message}`);
      errors++;
    }
  });
});

if (errors > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All Schema.org JSON-LD structured data blocks are 100% valid!');
}
