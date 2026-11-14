# Correctifs : tests reproductibles, stockage durable des PDF, sécurité

Les fichiers de cette archive portent **les mêmes chemins** que dans `gradhive-web.zip` : copiez-les par-dessus
(ils remplacent les anciens). Rien d'autre n'a été modifié, et aucune fonctionnalité n'a été ajoutée.

## 1. Tests reproductibles
**Cause :** `tests/e2e_web_smoke.py` visait le port 4300 alors que le README indique 4200 ; il réutilisait aussi une adresse e-mail fixe
(échec dès la 2ᵉ exécution) et un fichier dans `/tmp`.
**Correction :** port 4200 par défaut (variable `GRADHIVE_URL`), e-mail unique à chaque exécution, fichier temporaire portable,
`tests/requirements.txt`, et section « Lancer le test de bout en bout » dans le README.
**Vérifié :** deux exécutions consécutives sur le port 4200, sans redémarrer l'API : 9/9 chaque fois.

## 2. Stockage durable des PDF
Les fichiers vont maintenant sur le disque défini par `GRADHIVE_FILES_DISK` (`local` par défaut pour le développement, `s3` en production).
```bash
composer require league/flysystem-aws-s3-v3 "^3.0"     # dans le projet Laravel, puis commit de composer.json et composer.lock
```
Variables Render (déjà ajoutées à `render.yaml`) : `GRADHIVE_FILES_DISK=s3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_BUCKET`, `AWS_ENDPOINT`, `AWS_DEFAULT_REGION=auto`, `AWS_USE_PATH_STYLE_ENDPOINT=true`.
Créez un espace **privé** (Cloudflare R2, Amazon S3 ou équivalent compatible S3) : les PDF sont servis par l'API, jamais publiquement.
*Limites :* les fichiers déjà stockés en local ne sont pas migrés ; ne changez pas de disque une fois des fichiers enregistrés.
*Non vérifié :* l'envoi vers un vrai espace de stockage (aucun accès dans l'environnement de préparation).

## 3. Sécurité
| Sujet | Correction | Vérification |
|---|---|---|
| CORS | Plus de valeur `*` par défaut : seul `http://localhost:4200` est autorisé ; en production, `*` est ignoré (personne n'est autorisé) ; méthodes et en-têtes limités | Logique testée : défaut, production + `*`, production + adresses Vercel |
| Jetons | Durée de vie limitée (`TOKEN_TTL_MINUTES`, 8 h) ; l'API renvoie `expires_at` ; Angular oublie un jeton expiré | Jeton expiré → retour à la connexion, jeton effacé |
| Inscription | Limitée à 10 essais par minute (comme la connexion) | Syntaxe vérifiée |
| En-têtes | `vercel.json` : politique CSP stricte, nosniff, anti-framing, referrer, permissions | Test avec CSP stricte : 0 violation, styles appliqués, 9/9 |
| `localStorage` | Emplacement centralisé dans `auth.service.ts` (constante `storage`) | Pour une session perdue à la fermeture de l'onglet : `const storage: Storage = sessionStorage;` |

**À remplacer :** dans `web/vercel.json`, `VOTRE-API.onrender.com` par l'adresse réelle de l'API (sinon le navigateur bloque les appels).
**Sur `localStorage` :** un jeton qu'un script malveillant (XSS) pourrait lire reste le risque de fond. Angular échappe les contenus, la CSP
limite les scripts et l'expiration réduit l'impact. La solution la plus robuste (cookie `HttpOnly` avec Sanctum « SPA ») exige que le site et l'API
partagent un même domaine (par ex. `app.exemple.com` et `api.exemple.com`) : à prévoir si vous achetez un nom de domaine.
Facultatif : planifier `php artisan sanctum:prune-expired --hours=24` pour supprimer les jetons expirés.
**Non vérifié :** l'exécution de l'API Laravel (syntaxe PHP seulement).
