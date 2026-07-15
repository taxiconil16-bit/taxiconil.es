const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from .env file
require('dotenv').config();

 const PORT = Number.parseInt(process.env.PORT || '5001', 10);
 const HOST = process.env.HOST || '0.0.0.0';

const PROJECT_ROOT = __dirname;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRedirectRule(from, to, status) {
  const fromStr = String(from || '').trim();
  const toStr = String(to || '').trim();
  const statusStr = String(status || '').trim();
  if (!fromStr || fromStr.startsWith('#') || !toStr || !statusStr) return null;

  const isForce = statusStr.endsWith('!');
  const statusCode = Number.parseInt(isForce ? statusStr.slice(0, -1) : statusStr, 10);
  if (!Number.isFinite(statusCode)) return null;

  const hasSplat = fromStr.includes(':splat');
  const hasWildcard = fromStr.includes('*');

  let regexSource = '^';
  if (hasSplat) {
    regexSource += escapeRegExp(fromStr).replace(/:splat/g, '(?<splat>.*)');
  } else if (hasWildcard) {
    regexSource += escapeRegExp(fromStr).replace(/\*/g, '(?<splat>.*)');
  } else {
    regexSource += escapeRegExp(fromStr);
  }
  regexSource += '$';

  let fromRegex;
  try {
    fromRegex = new RegExp(regexSource);
  } catch {
    return null;
  }

  return {
    from: fromStr,
    to: toStr,
    statusCode,
    isForce,
    fromRegex,
    hasSplat: hasSplat || hasWildcard
  };
}

function loadRedirectsFile() {
  const redirectsPath = path.join(PROJECT_ROOT, '_redirects');
  if (!fs.existsSync(redirectsPath)) return [];
  const raw = fs.readFileSync(redirectsPath, 'utf8');
  const rules = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const rule = compileRedirectRule(parts[0], parts[1], parts[2]);
    if (rule) rules.push(rule);
  }
  return rules;
}

function compileHeaderRule(pattern, headers) {
  const p = String(pattern || '').trim();
  if (!p || p.startsWith('#')) return null;

  // Support patterns like /*, /css/*, *.webp
  let regexSource = '^';
  if (p.startsWith('*.')) {
    regexSource += '.*' + escapeRegExp(p.slice(1)) + '$';
  } else {
    regexSource += escapeRegExp(p).replace(/\\\*/g, '.*');
    regexSource += '$';
  }

  let regex;
  try {
    regex = new RegExp(regexSource);
  } catch {
    return null;
  }

  return { pattern: p, regex, headers };
}

function loadHeadersFile() {
  const headersPath = path.join(PROJECT_ROOT, '_headers');
  if (!fs.existsSync(headersPath)) return [];
  const raw = fs.readFileSync(headersPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rules = [];

  let currentPattern = null;
  let currentHeaders = {};

  const flush = () => {
    if (!currentPattern) return;
    const compiled = compileHeaderRule(currentPattern, currentHeaders);
    if (compiled) rules.push(compiled);
    currentPattern = null;
    currentHeaders = {};
  };

  for (const line of lines) {
    if (!line.trim()) {
      flush();
      continue;
    }

    // New block starts at non-indented line
    if (!/^\s/.test(line)) {
      flush();
      currentPattern = line.trim();
      continue;
    }

    const headerLine = line.trim();
    const sepIdx = headerLine.indexOf(':');
    if (sepIdx === -1) continue;
    const name = headerLine.slice(0, sepIdx).trim();
    const value = headerLine.slice(sepIdx + 1).trim();
    if (!name) continue;
    currentHeaders[name] = value;
  }
  flush();

  return rules;
}

const REDIRECT_RULES = loadRedirectsFile();
const HEADER_RULES = loadHeadersFile();

function applyHeaderRules(urlPath, res) {
  for (const rule of HEADER_RULES) {
    if (rule.regex.test(urlPath)) {
      for (const [k, v] of Object.entries(rule.headers)) {
        res.setHeader(k, v);
      }
    }
  }
}

function applyRedirectRules(urlPath) {
  for (const rule of REDIRECT_RULES) {
    const match = rule.fromRegex.exec(urlPath);
    if (!match) continue;

    let target = rule.to;
    const splatValue = match.groups && typeof match.groups.splat === 'string' ? match.groups.splat : '';
    if (rule.hasSplat) {
      target = target.replaceAll(':splat', splatValue);
      target = target.replaceAll('*', splatValue);
    }
    return { statusCode: rule.statusCode, location: target };
  }
  return null;
}

/** Host: header indica preview local (localhost, 127.0.0.1 o IPv6 loopback). */
function tcHostHeaderIsLocalDev(hostHeader) {
  const h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return false;
  return (
    h.startsWith('localhost') ||
    h.startsWith('127.0.0.1') ||
    h.startsWith('[::1]') ||
    h === '::1'
  );
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle Google Reviews API endpoint for local development
  if (req.url.startsWith('/api/google-reviews')) {
    const urlParts = url.parse(req.url, true);
    const query = urlParts.query;
    const lang = query.lang || 'es';

    // Clear module cache to always load latest version (for development)
    delete require.cache[require.resolve('./netlify/functions/google-reviews.js')];

    // Use the real Google Reviews function
    const googleReviewsHandler = require('./netlify/functions/google-reviews.js');
    
    // Simulate Netlify event object
    const event = {
      queryStringParameters: query
    };
    
    const context = {};
    
    // Call the handler
    googleReviewsHandler.handler(event, context)
      .then(result => {
        res.statusCode = result.statusCode;
        res.setHeader('Content-Type', result.headers['Content-Type']);
        res.setHeader('Access-Control-Allow-Origin', result.headers['Access-Control-Allow-Origin']);
        res.end(result.body);
      })
      .catch(error => {
        console.error('Error in Google Reviews handler:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      });
    
    return;
  }

  const parsedUrl = url.parse(req.url);

  const originalPathname = parsedUrl && parsedUrl.pathname ? parsedUrl.pathname : '/';
  let decodedPathname = originalPathname;
  try {
    decodedPathname = decodeURIComponent(decodedPathname);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  // Apply Netlify-style headers for the requested path
  applyHeaderRules(decodedPathname, res);

  // Local dev: disable aggressive caching from _headers (e.g. immutable assets)
  // so CSS/JS edits are reflected immediately.
  const hostHeaderEarly = (req.headers && req.headers.host) ? String(req.headers.host) : '';
  const isLocalHostEarly = tcHostHeaderIsLocalDev(hostHeaderEarly);
  if (isLocalHostEarly) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Apply Netlify-style redirects/rewrites
  const redirect = applyRedirectRules(decodedPathname);
  if (redirect) {
    if (redirect.statusCode === 200) {
      // rewrite (internal)
      if (parsedUrl) parsedUrl.pathname = redirect.location;
      decodedPathname = redirect.location;
    } else {
      res.statusCode = redirect.statusCode;
      res.setHeader('Location', redirect.location);
      res.end();
      return;
    }
  }

  // Dev convenience: most pages reference the minified bundle.
  // In local development we serve the non-minified file so fixes apply everywhere.
  if (parsedUrl && parsedUrl.pathname === '/js/script.min.js' && process.env.TC_DEV_UNMINIFIED === '1') {
    parsedUrl.pathname = '/js/script.js';
  }

  if (parsedUrl && parsedUrl.pathname === '/css/blog-article.min.css') {
    parsedUrl.pathname = '/css/blog-article.css';
  }

  let pathname = path.join(PROJECT_ROOT, `.${decodedPathname}`);
  
  // LOGIC FOR CLEAN URLS (No .html extension in browser)
  // 1. If it's a directory, try index.html
  if (fs.existsSync(pathname) && fs.statSync(pathname).isDirectory()) {
    pathname = path.join(pathname, 'index.html');
  } 
  // 2. If the file doesn't exist, try adding .html
  else if (!fs.existsSync(pathname)) {
    if (fs.existsSync(`${pathname}.html`)) {
      pathname = `${pathname}.html`;
    }
  }

  // Fallback for root
  if (decodedPathname === '/' && !fs.existsSync(pathname)) {
    pathname = path.join(PROJECT_ROOT, 'index.html');
  }

  const ext = path.parse(pathname).ext;
  const extLower = ext.toLowerCase();
  let contentType = mimeTypes[extLower] || 'text/plain';
  if (extLower === '.html' || extLower === '.css' || extLower === '.js' || extLower === '.json' || extLower === '.svg') {
    contentType = `${contentType}; charset=utf-8`;
  }

  fs.readFile(pathname, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end(`File not found: ${pathname}`);
      } else {
        res.writeHead(500);
        res.end(`Server error: ${err.code}`);
      }
    } else {
      let responseBody = data;
      if (extLower === '.html') {
        const hostHeader = (req.headers && req.headers.host) ? String(req.headers.host) : '';
        const isLocalHost = tcHostHeaderIsLocalDev(hostHeader);
        if (isLocalHost) {
          let html = data.toString('utf8');
          // Replace absolute production URLs with relative ones for local testing
          html = html.replaceAll('https://taxiconil.es/', '/');
          html = html.replaceAll('https://taxiconil.es', '');
          // Ensure images still work if they were absolute
          html = html.replaceAll('https://taxiconil.es/IMG/', '/IMG/');
          responseBody = Buffer.from(html, 'utf8');
        }
      }

      // Only set defaults if _headers didn't already define them
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', contentType);
      // Force charset=utf-8 for HTML files regardless of _headers
      if (extLower === '.html') {
        const existingCT = res.getHeader('Content-Type');
        if (existingCT && !existingCT.includes('charset')) {
          res.setHeader('Content-Type', `${existingCT}; charset=utf-8`);
        }
      }
      if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (!res.getHeader('Pragma')) res.setHeader('Pragma', 'no-cache');
      if (!res.getHeader('Expires')) res.setHeader('Expires', '0');

      res.statusCode = 200;
      res.end(responseBody);
    }
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`ERROR: el puerto ${PORT} ya esta en uso. Prueba: set PORT=5002 && node server.js`);
  } else {
    console.error('ERROR al arrancar el servidor:', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`HTTP Server listo:  http://127.0.0.1:${PORT}`);
  console.log(`               tambien http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log('(Escuchando en todas las interfaces; usa 127.0.0.1 si localhost falla.)');
  }
});
