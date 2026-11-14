# GradHive Mobile : prise en main et déploiement

Cette application est un client de l’API Laravel **existante** (`/api`, jetons Sanctum). Elle n’exige **aucune modification de l’API ni de la base** : rien ne peut donc perturber la production web.

## 1. Première installation
```bash
cd mobile
sh tool/setup.sh          # génère android/ et ios/, ajoute la permission INTERNET, installe les paquets
flutter analyze && flutter test
```
Le dépôt ne contient pas `android/` ni `ios/` : ils sont générés par `flutter create` (outil officiel) pour correspondre à votre version de Flutter.

## 2. Pointer vers une API
L’adresse est fixée à la compilation (`--dart-define`), jamais dans le code :

| Cible | Commande |
|---|---|
| Émulateur Android → API locale | `flutter run --dart-define=API_URL=http://10.0.2.2:8000/api` |
| Simulateur iOS → API locale | `flutter run --dart-define=API_URL=http://127.0.0.1:8000/api` |
| Téléphone réel → API locale | `--dart-define=API_URL=http://<IP-du-PC>:8000/api` (même Wi-Fi ; http autorisé seulement en debug) |
| Production | `flutter build appbundle --release --dart-define=API_URL=https://api.gradhive.com/api` |

Sans option, l’application vise l’API **locale** : une compilation oubliée ne touche jamais la production. Utilisez de préférence une API de recette (Render « preview » + branche Neon) avant la production.

## 3. CORS
Les applications natives n’envoient pas d’en-tête `Origin` : le réglage `CORS_ALLOWED_ORIGINS` (réservé au web) n’a **pas** à être modifié.

## 4. Android (Google Play, 15 000 FCFA une fois)
1. Créer une clé : `keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload` (la **sauvegarder**, la perdre bloque les mises à jour).
2. `android/key.properties` (non versionné) : `storePassword=… keyPassword=… keyAlias=upload storeFile=upload.jks`, puis référencer ce fichier dans `android/app/build.gradle(.kts)` (`signingConfigs.release`, voir la documentation Flutter « Build and release an Android app »).
3. Changer `applicationId` (`com.gradhive.gradhive_mobile` par défaut) avant la première publication : il est définitif.
4. `flutter build appbundle --release --dart-define=API_URL=…` → déposer l’`.aab` dans la Play Console (piste de test interne d’abord).

## 5. iOS (App Store, 59 400 FCFA par an)
Nécessite un Mac, Xcode et un compte Apple Developer. `open ios/Runner.xcworkspace`, régler l’identifiant et l’équipe de signature, puis `flutter build ipa --release --dart-define=API_URL=…` et envoi via Transporter ou Xcode (TestFlight d’abord). Les icônes se remplacent avec `docs/logos/choisi/icone-gradhive-mobile.png`.

## 6. Ce qui n’est pas inclus (à décider)
- **Notifications push** : l’API n’a ni jetons d’appareil ni FCM ; les notifications sont lues dans l’écran « Notifications ».
- **Renouvellement de session** : le jeton dure 8 h (`TOKEN_TTL_MINUTES`) ; ensuite l’application demande de se reconnecter.
- **Pagination** : l’API renvoie des listes complètes ou tronquées à 100 éléments.
- **Mentorat et messagerie** : absents de l’API comme du web.
- **Mode hors ligne** : aucune mise en cache locale pour l’instant.
