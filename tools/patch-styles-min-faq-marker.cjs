const fs = require('fs');
const p = require('path').join(__dirname, '../css/styles.min.css');
let s = fs.readFileSync(p, 'utf8');
const old = '#legal-faq summary::-webkit-details-marker{display:none}';
if (!s.includes(old)) {
  console.error('marker anchor not found');
  process.exit(1);
}
const neu = '#legal-faq summary::marker{content:"";font-size:0}' + old;
s = s.replace(old, neu);
fs.writeFileSync(p, s);
console.log('ok styles.min');
