const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p);
    } else if (ent.name.endsWith('.html')) patch(p);
  }
}

function patch(p) {
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('legal-overlay')) return;
  const n = c
    .split("getElementById('legal-overlay').classList.remove('is-open')")
    .join("getElementById('legal-overlay').classList.remove('is-open', 'visible')")
    .split('getElementById("legal-overlay").classList.remove("is-open")')
    .join('getElementById("legal-overlay").classList.remove("is-open", "visible")');
  if (n !== c) {
    fs.writeFileSync(p, n, 'utf8');
    console.log('close-patch', p);
  }
}

walk(root);
