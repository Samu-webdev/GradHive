# Génère les dossiers android/ et ios/ puis applique les réglages GradHive (Windows PowerShell 5.1).
# Usage, depuis le dossier mobile :  powershell -ExecutionPolicy Bypass -File tool\setup.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Write-Utf8([string]$path, [string]$text) {
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $text, (New-Object System.Text.UTF8Encoding($false)))
}

flutter create --org com.gradhive --project-name gradhive_mobile --platforms android,ios .
if ($LASTEXITCODE -ne 0) { throw 'flutter create a échoué' }
flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'flutter pub get a échoué' }

# 1. Permission INTERNET dans le manifeste principal (absente de la version release par défaut) + nom affiché
$manifest = 'android\app\src\main\AndroidManifest.xml'
$xml = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $manifest))
if ($xml -notmatch 'android.permission.INTERNET') {
    $xml = $xml -replace '<application', "<uses-permission android:name=`"android.permission.INTERNET`"/>`n    <application"
}
$xml = $xml -replace 'android:label="[^"]*"', 'android:label="GradHive"'
Write-Utf8 $manifest $xml

# 2. Debug uniquement : autoriser le HTTP vers l'API locale (la version release reste en HTTPS)
Write-Utf8 'android\app\src\debug\AndroidManifest.xml' @'
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application android:usesCleartextTraffic="true"/>
</manifest>
'@

Write-Host ''
Write-Host 'OK. Lancer un émulateur Android puis :'
Write-Host '  flutter run --dart-define=API_URL=http://10.0.2.2:8000/api'
Write-Host '(iOS ne peut être compilé que sur un Mac.)'
