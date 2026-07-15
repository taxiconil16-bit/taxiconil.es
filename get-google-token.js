const http = require('http');
const url = require('url');
require('dotenv').config();

// Polyfill for fetch in Node.js
const fetch = (...args) => {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(...args);
  }
  return import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
};

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

console.log('=== Google OAuth Token Generator ===');
console.log('CLIENT_ID:', CLIENT_ID ? 'SET' : 'NOT SET');
console.log('CLIENT_SECRET:', CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar en .env');
  process.exit(1);
}

// Paso 1: Generar URL de autorización
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.append('client_id', CLIENT_ID);
authUrl.searchParams.append('redirect_uri', 'http://localhost:3000');
authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/business.manage');
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('access_type', 'offline');
authUrl.searchParams.append('prompt', 'consent');

console.log('PASO 1: Abre esta URL en tu navegador y autoriza la aplicación:');
console.log(authUrl.toString());
console.log('');
console.log('Después de autorizar, serás redirigido a http://localhost:3000?code=...');
console.log('Copia el código de la URL y pégalo aquí cuando te lo pida.');
console.log('');

// Paso 2: Servidor local para recibir el código de autorización
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const code = parsedUrl.query.code;

  if (code) {
    console.log('Código de autorización recibido:', code);
    console.log('');
    console.log('Intercambiando código por refresh token...');

    // Paso 3: Intercambiar código por tokens
    fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: 'http://localhost:3000',
        grant_type: 'authorization_code',
      }),
    })
    .then(response => response.json())
    .then(data => {
      console.log('');
      console.log('=== TOKENS OBTENIDOS ===');
      console.log('Refresh Token (copia esto a tu .env):');
      console.log(data.refresh_token);
      console.log('');
      console.log('Access Token:', data.access_token);
      console.log('');
      console.log('Ahora actualiza tu archivo .env con:');
      console.log('GOOGLE_REFRESH_TOKEN=' + data.refresh_token);
      console.log('');
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>¡Autorización completada!</h1>
        <p>Refresh token obtenido. Mira la terminal para ver el token.</p>
        <p>Puedes cerrar esta página.</p>
      `);
      
      server.close();
    })
    .catch(error => {
      console.error('Error al obtener tokens:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Error al obtener tokens</h1><p>Mira la terminal para más detalles.</p>');
      server.close();
    });
  } else {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>Error: No se recibió código de autorización</h1>');
  }
});

server.listen(3000, () => {
  console.log('Servidor escuchando en http://localhost:3000');
  console.log('Esperando que completes la autorización en el navegador...');
  console.log('');
});
