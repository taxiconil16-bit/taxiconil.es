const fs = require('fs');
const { minify } = require('terser');

async function minifyScript() {
  const code = fs.readFileSync('js/script.js', 'utf8');
  const result = await minify(code, { 
    compress: { 
      drop_console: false,
      pure_funcs: [],
      keep_fargs: true
    }, 
    mangle: true 
  });
  if (result.code) {
    fs.writeFileSync('js/script.min.js', result.code);
    console.log('Minified successfully');
  } else {
    console.error('Minification failed:', result);
  }
}

minifyScript();
