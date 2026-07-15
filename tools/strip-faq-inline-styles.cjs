const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const RE = /<style>[\s\S]*?\/\*\s*(FAQ Styles|Frequently Asked Questions)[^\n]*\*\/[\s\S]*?<\/style>\s*/g;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'tools') continue;
      walk(p);
    } else if (ent.name.endsWith('.html')) strip(p);
  }
}

function strip(p) {
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('FAQ Styles')) return;
  const n = c.replace(RE, '');
  if (n !== c) {
    fs.writeFileSync(p, n, 'utf8');
    console.log('strip-faq-style', p);
  }
}

walk(root);
