# GradHive Mobile (Flutter, Android et iOS)

Client mobile de la plateforme GradHive : **même API Laravel et même base PostgreSQL que le web**, aucune modification du serveur.

## Fonctionnalités (parité avec le web)
Visiteur : accueil et statistiques, projets/mémoires (recherche, filtres, détail, PDF), postes TA/RA (vérification d’admissibilité), opportunités, annuaire (recherche publique), profils publics étudiants et établissements, recherche globale, FR/EN.
Étudiant : inscription/connexion, profil et visibilité, publier/modifier/supprimer ses projets (PDF 20 Mo), candidatures TA/RA, candidatures aux opportunités (pièces PDF, historique, retrait), favoris, connexions, fil d’actualité, notifications, signalements.
École : profil, étudiants mis en avant, publications institutionnelles, gestion des opportunités et des candidatures reçues.
Entreprise / organisme : publication et gestion d’opportunités, examen des candidatures (statuts, pièces jointes).
Mentor : profil membre, annuaire, connexions. Administrateur : indicateurs, comptes (suspension), signalements.

Les gardes de rôle reproduisent celles du web (`lib/router.dart`) ; l’API reste l’autorité (chaque appel est revérifié côté serveur).

## Démarrer
Voir `docs/DEPLOIEMENT.md` (installation, adresse de l’API, Google Play, App Store, CI).

## Architecture
`lib/core` (client HTTP, session et jeton en stockage sécurisé, traductions) · `lib/widgets` (composants communs) · `lib/screens` (un fichier par module) · `test/` (client API, libellés, gardes de rôles).

## État de vérification
**Ce code n’a pas été compilé ni exécuté** (le SDK Flutter n’était pas accessible lors de sa rédaction). Seuls l’équilibre syntaxique des fichiers et la cohérence des formats avec `routes/api.php` et les contrôleurs ont été contrôlés. Lancez `flutter analyze` puis `flutter test` avant tout autre usage ; attendez-vous à corriger quelques erreurs de compilation.
