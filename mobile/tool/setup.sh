#!/usr/bin/env sh
# Génère les dossiers android/ et ios/ (non fournis) puis applique les réglages GradHive.
# Usage : sh tool/setup.sh   (Flutter ≥ 3.27 installé ; sous Windows, utiliser Git Bash ou WSL)
set -e
cd "$(dirname "$0")/.."
flutter create --org com.gradhive --project-name gradhive_mobile --platforms android,ios .
flutter pub get

# 1. Permission INTERNET dans le manifeste principal : « flutter create » ne l'ajoute que pour debug/profile,
#    une version release sans elle ne pourrait joindre aucune API.
MANIFEST=android/app/src/main/AndroidManifest.xml
if ! grep -q 'android.permission.INTERNET' "$MANIFEST"; then
  sed -i.bak 's#<application#<uses-permission android:name="android.permission.INTERNET"/>\n    <application#' "$MANIFEST" && rm -f "$MANIFEST.bak"
fi
# 2. Nom affiché de l'application
sed -i.bak 's#android:label="[^"]*"#android:label="GradHive"#' "$MANIFEST" && rm -f "$MANIFEST.bak"
# 3. Debug uniquement : autoriser le HTTP vers l'API locale (Android 9+ le bloque par défaut).
#    La version release (src/main) reste en HTTPS obligatoire.
cat > android/app/src/debug/AndroidManifest.xml <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application android:usesCleartextTraffic="true"/>
</manifest>
XML
# 4. iOS : autoriser uniquement le réseau local (API de développement), pas le HTTP vers Internet.
if [ -x /usr/libexec/PlistBuddy ] && ! /usr/libexec/PlistBuddy -c "Print :NSAppTransportSecurity" ios/Runner/Info.plist >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" ios/Runner/Info.plist
fi
echo "OK. Lancer : flutter run --dart-define=API_URL=http://10.0.2.2:8000/api"
