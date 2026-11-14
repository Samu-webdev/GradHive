# Contrat de l’API GradHive

Toutes les routes ci-dessous sont relatives à `/api`. Les routes protégées nécessitent un jeton Bearer Sanctum.

## Authentification

- `POST /register` crée un compte et renvoie le profil et le jeton.
- `POST /login` authentifie un compte et renvoie le profil et le jeton.
- `POST /logout` révoque le jeton courant.
- `GET /me` renvoie le profil du compte connecté.

## Travaux académiques

- `GET /works` liste les travaux ; filtres disponibles : `q`, `author_id`, `year`, `level` et `mention`.
- `GET /works/{id}` renvoie un travail et incrémente son nombre de vues.
- `POST /works` (étudiant connecté) publie un travail. Champs requis : `title`, `abstract`, `theme`, `level`, `year`, `keywords` et un fichier PDF de 20 Mo maximum. `mention` et `supervisor` sont facultatifs.
- `GET /my/works` (étudiant connecté) liste ses travaux.
- `GET /works/{id}/download` (utilisateur connecté) télécharge le PDF.

La publication d’un travail ne vaut pas validation académique. Les travaux présentés sont accessibles publiquement ; les téléchargements nécessitent une connexion.

## Postes TA/RA et candidatures

- `GET /universities` et `GET /universities/{id}` consultent les établissements associés aux postes.
- `GET /positions` accepte les filtres `q`, `type`, `country` et `university_id`.
- `GET /positions/{id}` renvoie un poste.
- `POST /positions/{id}/check` vérifie publiquement les critères d’admissibilité.
- `POST /positions/{id}/applications` (étudiant connecté) soumet une candidature et les pièces PDF requises par le poste.
- `GET /my/applications` (étudiant connecté) liste ses candidatures.

## Statistiques

- `GET /stats` renvoie les nombres de travaux, universités, postes et utilisateurs.

Les contrôles de rôle sont appliqués par l’API ; masquer une route dans l’interface ne remplace pas ces contrôles.
