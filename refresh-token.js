const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

console.log('=== Generar nuevo Refresh Token ===');
console.log('CLIENT_ID:', CLIENT_ID ? 'SET' : 'NOT SET');
console.log('CLIENT_SECRET:', CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('');

// Generar URL de autorización con redirect URI localhost:5001
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=http://localhost:5001&scope=https://www.googleapis.com/auth/business.manage&response_type=code&access_type=offline&prompt=consent`;

console.log('1. Abre esta URL en tu navegador:');
console.log(authUrl);
console.log('');
console.log('2. Autoriza la aplicación');
console.log('3. Copia el código de la URL después de redirigir (parámetro "code=")');
console.log('4. Pega el código aquí:');
console.log('');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Pega el código de autorización aquí (o la URL completa): ', (input) => {
  // Extraer el código si el usuario pega la URL completa
  let code = input;
  if (input.includes('code=')) {
    const match = input.match(/code=([^&]+)/);
    if (match) {
      code = match[1];
    }
  }
  console.log('Código extraído:', code);
  console.log('Intercambiando código por refresh token...');

  const postData = querystring.stringify({
    code: code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: 'http://localhost:5001',
    grant_type: 'authorization_code'
  });

  const options = {
    hostname: 'oauth2.googleapis.com',
    port: 443,
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.refresh_token) {
          console.log('');
          console.log('=== REFRESH TOKEN OBTENIDO ===');
          console.log('GOOGLE_REFRESH_TOKEN=' + result.refresh_token);
          console.log('');
          console.log('Copia esto y actualiza tu archivo .env');
        } else {
          console.error('Error: No se obtuvo refresh token');
          console.error('Respuesta:', data);
        }
      } catch (e) {
        console.error('Error al parsear respuesta:', e);
        console.error('Respuesta:', data);
      }
      rl.close();
    });
  });

  req.on('error', (e) => {
    console.error('Error en la petición:', e);
    rl.close();
  });

  req.write(postData);
  req.end();
});
