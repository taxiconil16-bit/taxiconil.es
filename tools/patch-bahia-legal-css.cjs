const fs = require('fs');
const path = require('path');
const needle = 'script.fix_20260414_1026.min.js';
const insert =
  '    <link rel="stylesheet" href="/css/legal-overlay-prose.css?v=20260513c"/>\n';
const anchors = [
  '<noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin/></noscript>',
  '<noscript><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet" crossorigin/></noscript>',
];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p);
    } else if (ent.name.endsWith('.html')) tryFile(p);
  }
}

function tryFile(p) {
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes(needle)) return;
  if (c.includes('legal-overlay-prose.css?v=20260513c')) return;
  for (const a of anchors) {
    if (c.includes(a)) {
      c = c.replace(a, a + '\n' + insert);
      fs.writeFileSync(p, c, 'utf8');
      console.log('css-link', p);
      return;
    }
  }
  console.warn('skip-no-fa-noscript', p);
}

walk(path.join(__dirname, '..'));
