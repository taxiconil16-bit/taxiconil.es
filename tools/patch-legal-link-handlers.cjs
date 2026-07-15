const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p);
    } else if (ent.name.endsWith('.html')) patchFile(p);
  }
}

const RE = /link\.addEventListener\('click',\s*function\s*\(\s*e\s*\)\s*\{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*(\r?\n\s*)const targetId = this\.dataset\.target;/g;

function patchFile(p) {
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('.legal-link')) return;
  const n = c.replace(
    RE,
    "link.addEventListener('click', function(e) {\n                if (!this.dataset.target) return;\n                e.preventDefault();\n                e.stopPropagation();$1const targetId = this.dataset.target;"
  );
  if (n !== c) {
    fs.writeFileSync(p, n, 'utf8');
    console.log('patched', p);
  }
}

walk(root);
