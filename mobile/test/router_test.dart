import 'package:flutter_test/flutter_test.dart';
import 'package:gradhive_mobile/core/api.dart';
import 'package:gradhive_mobile/core/session.dart';
import 'package:gradhive_mobile/router.dart';

Session _session({String? role}) {
  final api = ApiClient(baseUrl: 'http://x/api');
  final s = Session(api)..ready = true;
  if (role != null) {
    api.token = 't';
    s.user = {'id': 1, 'name': 'Test', 'role': role};
  }
  return s;
}

String? _go(Session s, String path) => redirectFor(s, Uri.parse(path));

void main() {
  test('visiteur : pages publiques accessibles, pages protégées renvoyées vers la connexion', () {
    final s = _session();
    expect(_go(s, '/memoires'), isNull);
    expect(_go(s, '/opportunites/3'), isNull);
    expect(_go(s, '/mes-memoires'), startsWith('/connexion?redirect='));
    expect(_go(s, '/actualites'), startsWith('/connexion'));
  });

  test(
    'étudiant : accès à ses espaces, refusé sur administration et gestion',
    () {
      final s = _session(role: 'student');
      expect(_go(s, '/mes-memoires'), isNull);
      expect(_go(s, '/memoires/12/modifier'), isNull);
      expect(_go(s, '/administration'), '/');
      expect(_go(s, '/gestion-opportunites'), '/');
    },
  );

  test('entreprise : peut publier des opportunités, pas des projets', () {
    final s = _session(role: 'company');
    expect(_go(s, '/gestion-opportunites/nouvelle'), isNull);
    expect(_go(s, '/memoires/publier'), '/');
    expect(_go(s, '/mon-profil'), '/');
  });

  test('connecté : /connexion renvoie à l’accueil ; administrateur : accès à /administration', () {
    expect(_go(_session(role: 'student'), '/connexion'), '/');
    expect(_go(_session(role: 'admin'), '/administration'), isNull);
  });

  test('établissement : mises en avant et publications autorisées', () {
    final s = _session(role: 'school');
    expect(_go(s, '/mises-en-avant'), isNull);
    expect(_go(s, '/publications-institutionnelles'), isNull);
  });
}
