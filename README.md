# GradHive
<<<<<<< HEAD

GradHive est une plateforme bilingue (français/anglais) qui valorise les parcours et travaux académiques, met en relation les membres et donne accès à des opportunités professionnelles et académiques.

## Structure

| Dossier | Contenu |
|---|---|
| `web/` | Application Angular 22, interface réactive FR/EN |
| `gradhive-api/` | API Laravel actuelle, Sanctum et PostgreSQL |
| `mobile/` | Application Flutter (Android/iOS) qui réutilise l’API Laravel (voir `mobile/README.md`) |
| `mock-api/` | API Node de démonstration en mémoire, utile pour les parcours historiques du web |
| `tests/` | Tests de parcours Playwright |
| `docs/` | Identité de marque GradHive |

## Fonctionnalités disponibles

- Inscription, connexion, gestion de session Sanctum et contrôle des rôles côté API.
- Profils publics étudiant/établissement avec confidentialité configurable et étudiants mis en avant par les écoles.
- Publication, édition, visibilité privée/publique, recherche et téléchargement contrôlé des travaux académiques PDF.
- Postes TA/RA, vérification des critères d’admissibilité et candidatures.
- Opportunités d’emploi, de stage, de bourse, de mobilité, de recherche et TA/RA : publication et gestion par écoles, entreprises et organismes ; favoris ; candidatures avec documents PDF et historique des statuts.
- Annuaire, demandes de connexion, actualités institutionnelles, fil chronologique, signalements et notifications.
- Tableau de bord d’administration, indicateurs, recherche/suspension des comptes et traitement des signalements.
- Interface adaptative et changement instantané français/anglais.

Les étudiants publient leurs travaux sans validation académique par l’école. La mise en avant institutionnelle est promotionnelle et ne constitue pas une certification.

## Installation locale sous Windows

Prérequis : PHP 8.3 ou ultérieur, Composer 2, Node.js 22.22.3 ou ultérieur (ou 24.15+, exigé par Angular 22) et PostgreSQL. Pour les fichiers PDF, activez aussi `fileinfo` dans le `php.ini` du PHP CLI. Avec PHP 8.4 installé dans `C:\php8.4`, utilisez explicitement `C:\php8.4\php.exe` pour les commandes Laravel.

### 1. Installer les dépendances

Depuis `C:\Users\user\gradhive-web` :

```powershell
composer install --working-dir=gradhive-api
npm install --prefix web
```

### 2. Configurer et migrer l’API

```powershell
Set-Location C:\Users\user\gradhive-web\gradhive-api
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Select-String -Path .env -Pattern '^APP_KEY=.+$' -Quiet)) { & 'C:\php8.4\php.exe' artisan key:generate }
```

Avant les migrations, vérifiez dans `gradhive-api\.env` que `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` et `DB_PASSWORD` correspondent à votre instance PostgreSQL. Ne remplacez pas un `.env` existant sans en conserver les paramètres. Vérifiez également que `pdo_pgsql` et `pgsql` sont chargés par le même PHP CLI.
Si `fileinfo` n’apparaît pas, activez `extension=fileinfo` dans `C:\php8.4\php.ini`, puis redémarrez les processus PHP.

```powershell
& 'C:\php8.4\php.exe' -m | Select-String 'pdo_pgsql|pgsql|fileinfo'
& 'C:\php8.4\php.exe' artisan config:clear
& 'C:\php8.4\php.exe' artisan migrate --seed
```

Le seeder crée (hors production) les comptes de démonstration et des offres fictives d’emploi, de stage, de bourse, de mobilité et de recherche. Leurs titres commencent par « Démo GradHive » ; remplacez ces exemples avant toute diffusion.

### 3. Démarrer les services

Dans deux terminaux distincts :

```powershell
# Terminal API, depuis gradhive-api
& 'C:\php8.4\php.exe' artisan serve --host=127.0.0.1 --port=8000
```

```powershell
# Terminal web, depuis la racine du projet
npm start
```

Le site sera disponible sur `http://localhost:4200` et l’API sur `http://localhost:8000/api`.
Comptes de démonstration après `php artisan migrate --seed` (mot de passe `password`) :
`student@gradhive.test`, `school@gradhive.test`, `admin@gradhive.test`.

### Commandes de vérification

```powershell
# Depuis la racine
npm run build
Set-Location C:\Users\user\gradhive-web\gradhive-api
& 'C:\php8.4\php.exe' -d extension=fileinfo vendor\bin\phpunit
```

Pour le parcours Playwright, démarrez l’API et le web, puis :

```powershell
pip install -r tests\requirements.txt
playwright install chromium
$env:GRADHIVE_URL = "http://localhost:4200"
python tests\e2e_web_smoke.py
```

Le scénario vérifie inscription, profils, travaux publics/privés, mise en avant institutionnelle, annuaire et connexions, postes TA/RA, candidatures et pages d’erreur.

## API

Les routes et leur contrat sont documentés dans [gradhive-api/API_CONTRACT.md](gradhive-api/API_CONTRACT.md). Après une mise à jour du code, appliquez les nouvelles migrations depuis `gradhive-api` :

```powershell
php artisan migrate
```

En production, le seeder ne crée aucun compte tant que `DEMO_PASSWORD` n’est pas défini (voir `AUDIT.md`). Configurez PostgreSQL, HTTPS, CORS et un stockage persistant pour les PDF. Les jetons et clés doivent rester dans les variables d’environnement ; ne publiez jamais le fichier `.env`.

## Préparer le paquet de production

Ces exclusions concernent uniquement le paquet déployé ; ne supprimez pas ces dossiers du poste ou du dépôt.

- Pour l’API Laravel actuelle, excluez `mock-api/` (API de démonstration).
- `tests/`, `gradhive-api/tests/`, `docs/` et `web/.vscode/` ne sont pas nécessaires à l’exécution.
- Excluez les dépendances et caches locaux (`web/node_modules/`, `web/.angular/`, `gradhive-api/vendor/`) si l’hébergeur installe lui-même les dépendances.
- Si l’hébergeur compile le frontend, il génère `web/dist/`. Pour un hébergement statique sans compilation, conservez `web/dist/web/browser/`.
- Le `storage/` à la racine est un résidu distinct de `gradhive-api/storage/` ; il peut être omis s’il ne contient aucun fichier utilisateur.
- N’incluez jamais `gradhive-api/.env` ni la base locale `gradhive-api/database/database.sqlite`.

Conservez `web/src/`, `web/public/`, `gradhive-api/app/`, `routes/`, `config/`, `database/migrations/`, les manifestes de dépendances et `gradhive-api/storage/` (stockage et exécution Laravel). Avant Vercel, renseignez `API_URL` et remplacez l’origine d’exemple `https://VOTRE-API.onrender.com` dans la CSP de `web/vercel.json`. Côté Render, renseignez `CORS_ALLOWED_ORIGINS` et les secrets PostgreSQL/stockage.

Les données et comptes de démonstration sont fictifs ; remplacez-les avant une mise en production.
=======
GradHive est un réseau d'authenticité institutionnelle. GradHive redéfinit les règles de visibilité . Il garantit une égalité des chances en propulsant la visibilité des jeunes diplômés dès le jour de leur graduation auprès des entreprises et hubs technologiques, indépendamment de toute expérience préalable .
>>>>>>> bc8c0ccac1502311ae079b7c36b4c4d9181aeaa9
