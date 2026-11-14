# GradHive : application web (Angular 19)

```bash
npm install
npm start            # http://localhost:4200
npm run build        # production -> dist/web/browser
```

L'URL de l'API est lue dans `public/config.js` (`window.__GRADHIVE__.apiUrl`). Sur Vercel, définissez la variable
d'environnement `API_URL` (ex. `https://gradhive-api.onrender.com/api`) : `npm run build` régénère `config.js`.
