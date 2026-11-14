// Génère public/config.js à partir de la variable d'environnement API_URL (utilisé par `npm run build` sur Vercel).
const fs = require('fs');
const url = process.env.API_URL;
if (url) {
  fs.writeFileSync('public/config.js', `window.__GRADHIVE__ = { apiUrl: ${JSON.stringify(url)} };\n`);
  console.log('config.js généré pour', url);
} else {
  console.log('API_URL non défini : config.js conservé tel quel.');
}
