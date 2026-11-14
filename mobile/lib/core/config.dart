/// Adresse de l'API, fournie à la compilation :
///   flutter run --dart-define=API_URL=http://10.0.2.2:8000/api            (émulateur Android → API locale)
///   flutter build apk --dart-define=API_URL=https://api.gradhive.com/api   (production)
/// Par défaut : API locale, de sorte qu'une compilation « oubliée » ne touche jamais la production.
class Config {
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8000/api',
  );
}
