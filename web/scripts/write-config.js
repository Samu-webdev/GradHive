const fs = require('fs');

const url = process.env.API_URL || process.env.URL_API;

if (url) {
  fs.writeFileSync(
    'public/config.js',
    `window.__GRADHIVE__ = { apiUrl: ${JSON.stringify(url)} };\n`
  );
  console.log('config.js généré pour', url);
} else {
  console.log('API_URL ou URL_API non défini : config.js conservé tel quel.');
}
