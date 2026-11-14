import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:gradhive_mobile/core/api.dart';

void main() {
  test('ajoute le jeton Bearer et décode le JSON', () async {
    late http.Request seen;
    final api = ApiClient(
      baseUrl: 'http://x/api',
      client: MockClient((r) async {
        seen = r;
        return http.Response(
          jsonEncode({
            'data': [1, 2],
          }),
          200,
        );
      }),
    )..token = 'abc';
    final r = await api.get('/works', query: {'q': 'ia', 'level': ''});
    expect(r['data'], [1, 2]);
    expect(seen.headers['Authorization'], 'Bearer abc');
    expect(
      seen.url.toString(),
      'http://x/api/works?q=ia',
    ); // les filtres vides sont omis
  });

  test('erreur 422 : première erreur de validation exposée', () async {
    final api = ApiClient(
      baseUrl: 'http://x/api',
      client: MockClient(
        (r) async => http.Response(
          jsonEncode({
            'message': 'invalid',
            'errors': {
              'email': ['Adresse e-mail invalide.'],
            },
          }),
          422,
        ),
      ),
    );
    expect(
      () => api.post('/login', {}),
      throwsA(
        isA<ApiException>()
            .having((e) => e.display, 'display', 'Adresse e-mail invalide.')
            .having((e) => e.status, 'status', 422),
      ),
    );
  });

  test('401 avec jeton : déclenche onUnauthorized', () async {
    var called = false;
    final api = ApiClient(
      baseUrl: 'http://x/api',
      client: MockClient(
        (r) async => http.Response('{"message":"Unauthenticated."}', 401),
      ),
      onUnauthorized: () => called = true,
    )..token = 't';
    await expectLater(api.get('/me'), throwsA(isA<ApiException>()));
    expect(called, isTrue);
  });

  test('réseau coupé : message explicite, pas de crash', () async {
    final api = ApiClient(
      baseUrl: 'http://x/api',
      client: MockClient((r) async => throw Exception('offline')),
    );
    expect(
      () => api.get('/stats'),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 0)),
    );
  });
}
