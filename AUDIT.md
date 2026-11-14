# Audit GradHive (novembre 2026) : ce qui a été corrigé, vérifié et laissé de côté

## Corrigé (sans changer les fonctionnalités)

| Zone | Correction | Vérification |
|---|---|---|
| Angular | 19.2 → **22.2.5** (migrations officielles `ng update` 20, 21, 22 ; TypeScript 6). `npm audit --omit=dev` : 7 failles (4 hautes) → **0**. Les migrations automatiques n’ont fait qu’expliciter `changeDetection: Eager` et `withXhr()` (comportement identique) | `ng build` réussi ; page d’accueil chargée dans Chromium sans erreur JS |
| Angular | Imports inutilisés supprimés (`DatePipe`, `ToastService`, types) ; `engines` Node ≥ 22.22.3 / 24.15 (exigé par Angular 22) et `.nvmrc` | `tsc --noUnusedLocals` propre |
| Production | `SEED_DEMO_DATA` passe à `false` dans `render.yaml` : avec `true`, le seeder **réinitialisait à chaque déploiement** le compte `admin@gradhive.test` au mot de passe public `password` | relu ; test du seeder inchangé (hors production le mot de passe reste `password`) |
| Production | Comptes de démonstration créés en production **seulement** si `DEMO_PASSWORD` est défini | relu |
| Production | Pilote S3 (`league/flysystem-aws-s3-v3`) absent de `composer.json` alors que `GRADHIVE_FILES_DISK=s3` : installé dans le `Dockerfile` | **non vérifié** (pas d’accès à Packagist ici) |
| Production | `.dockerignore` ajouté : le `.env` (mot de passe BD, `APP_DEBUG=true`), la base SQLite, les logs et les PDF locaux n’entrent plus dans l’image | relu |
| Production | `trustProxies` (API derrière le proxy HTTPS de Render) + en-têtes `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS ; `LOG_CHANNEL=stderr` | syntaxe PHP vérifiée |
| API | La racine `/` n’affiche plus la page par défaut de Laravel (72 Ko) mais un JSON d’état | relu |
| PostgreSQL | Migration `2026_11_08_000001_add_performance_indexes` : index sur les clés étrangères et filtres fréquents (PostgreSQL n’en crée pas sur les clés étrangères). Additive et réversible, ne crée un index que s’il manque | syntaxe vérifiée ; **à exécuter d’abord sur une copie de la base** |
| Nettoyage | Supprimés : ancien kit `backend/`, scaffolding Vite/npm de l’API, `welcome.blade.php`, `storage/` et `tests/` résiduels de la racine, dossier imbriqué `gradhive-api/gradhive-api`, `laravel.log`, `database.sqlite`, cache PHPUnit, PDF de test | |
| Documentation | `API_CONTRACT.md` réécrit : il ne couvrait qu’environ 40 % des routes | comparé à `routes/api.php` |

## Non vérifié (à faire de votre côté)
- **Les tests PHPUnit n’ont pas pu être exécutés** : pas d’accès à Packagist, donc pas de `vendor/`. Lancez `php artisan test` avant tout déploiement.
- Le test Python de bout en bout (`tests/e2e_web_smoke.py`) n’a pas été rejoué.
- Le `composer.lock` n’a pas été régénéré.

## Déployer sans perturber la production
1. Sauvegardez la base Neon (branche Neon ou `pg_dump`).
2. Dans Render, définissez `SEED_DEMO_DATA=false` (ou laissez le nouveau `render.yaml` s’appliquer), et si besoin `DEMO_PASSWORD`. **Changez le mot de passe de `admin@gradhive.test`** s’il existe déjà en production.
3. Sur Vercel, utilisez Node 22.22.3+ ; remplacez `VOTRE-API.onrender.com` dans `web/vercel.json`.
4. Déployez l’API d’abord (la migration d’index s’applique au démarrage), puis le web. Aucune route ni colonne existante n’a changé : l’ancien front reste compatible avec la nouvelle API.
5. Exécutez en local `composer require league/flysystem-aws-s3-v3 "^3.0"` et validez `composer.json`/`composer.lock`, puis retirez la ligne correspondante du `Dockerfile`.

## Constats **non corrigés** (changeraient le comportement, à décider)
1. **Comptes d’établissement, d’entreprise et d’organisme actifs dès l’inscription**, sans validation : n’importe qui peut se déclarer « école ». Le rattachement étudiant ↔ école repose sur une égalité de texte (`institution`). → statut `pending` + validation par l’administrateur + clé étrangère.
2. Pas de vérification d’e-mail ni de réinitialisation de mot de passe.
3. Jeton de 8 h sans renouvellement ; stocké en `localStorage` (voir `CORRECTIFS.md`).
4. Aucune pagination (`/works` renvoie tout ; 100 max pour le fil, l’annuaire, les opportunités).
5. Messages d’erreur mêlant français et anglais ; pas de codes d’erreur stables.
6. `positions` + `applications` et `opportunities` + `opportunity_applications` font double emploi (TA/RA).
7. Recherche par `LIKE '%…%'` : à remplacer par `pg_trgm` ou le full-text PostgreSQL à la montée en charge.
8. Compteur de vues incrémenté à chaque lecture ; notification synchrone de tous les étudiants à chaque opportunité publiée (à passer en file d’attente).
9. `php artisan serve` en production et plan Render gratuit (démarrage à froid) ; aucun test unitaire Angular (`ng test` n’a aucun fichier de test) ; `mock-api/` a divergé de l’API réelle.
10. Le module de mentorat et la messagerie n’existent pas côté API.

## Application mobile (`mobile/`)
Projet Flutter ajouté sans toucher à l’API ni à la base. **Non compilé** (SDK inaccessible depuis l’environnement de rédaction) : voir `mobile/README.md`. Les adresses d’API se fixent à la compilation (`--dart-define=API_URL`), par défaut vers l’API locale, afin qu’aucune compilation ne vise la production par erreur.
