import 'dart:convert';

import 'package:file_selector/file_selector.dart' show XFile;
import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  final Map<String, List<String>> errors;
  ApiException(this.status, this.message, [this.errors = const {}]);

  /// Message lisible : première erreur de validation, sinon message serveur.
  String get display => errors.isNotEmpty && errors.values.first.isNotEmpty
      ? errors.values.first.first
      : message;

  @override
  String toString() => 'ApiException($status): $message';
}

/// Fichier choisi par l'utilisateur (PDF).
class PickedFile {
  final String name;
  final int size;
  final XFile xfile;
  PickedFile(this.name, this.size, this.xfile);
}

/// Fichier PDF à envoyer dans un champ multipart.
class UploadFile {
  final String field;
  final PickedFile file;
  UploadFile(this.field, this.file);
}

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl, this.onUnauthorized})
    : _client = client ?? http.Client(),
      baseUrl = baseUrl ?? Config.apiUrl;

  final http.Client _client;
  final String baseUrl;
  String? token;
  void Function()? onUnauthorized;

  Map<String, String> get _headers => {
    'Accept': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && v.toString().isNotEmpty) q[k] = v.toString();
    });
    return Uri.parse('$baseUrl$path')
        .replace(queryParameters: q.isEmpty ? null : q);
  }

  dynamic _handle(http.Response r) {
    dynamic body;
    if (r.body.isNotEmpty) {
      try {
        body = jsonDecode(utf8.decode(r.bodyBytes));
      } catch (_) {
        body = null;
      }
    }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final errs = <String, List<String>>{};
    if (body is Map && body['errors'] is Map) {
      (body['errors'] as Map).forEach((k, v) {
        errs['$k'] = v is List ? v.map((e) => '$e').toList() : ['$v'];
      });
    }
    final msg = body is Map && body['message'] != null
        ? '${body['message']}'
        : 'Erreur ${r.statusCode}';
    if (r.statusCode == 401 && token != null) onUnauthorized?.call();
    throw ApiException(r.statusCode, msg, errs);
  }

  Future<dynamic> _guard(Future<http.Response> Function() f) async {
    try {
      return _handle(await f().timeout(const Duration(seconds: 40)));
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        0,
        'Connexion impossible. Vérifiez votre réseau puis réessayez.',
      );
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _guard(() => _client.get(_uri(path, query), headers: _headers));

  Future<dynamic> send(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) => _guard(() async {
    final req = http.Request(method, _uri(path))
      ..headers.addAll({..._headers, 'Content-Type': 'application/json'})
      ..body = jsonEncode(body ?? {});
    return http.Response.fromStream(await _client.send(req));
  });

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      send('POST', path, body);
  Future<dynamic> put(String path, [Map<String, dynamic>? body]) =>
      send('PUT', path, body);
  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) =>
      send('PATCH', path, body);
  Future<dynamic> delete(String path) => send('DELETE', path);

  /// Envoi multipart. Laravel n'accepte pas de fichier en PUT : pour une mise à jour on envoie en POST
  /// avec le champ `_method` (route PUT/PATCH de l'API).
  Future<dynamic> multipart(
    String path,
    Map<String, String> fields,
    List<UploadFile> files, {
    String method = 'POST',
  }) => _guard(() async {
    final req = http.MultipartRequest('POST', _uri(path))
      ..headers.addAll(_headers);
    req.fields.addAll(fields);
    if (method != 'POST') req.fields['_method'] = method;
    for (final f in files) {
      req.files.add(
        http.MultipartFile.fromBytes(f.field, await f.file.xfile.readAsBytes(), filename: f.file.name),
      );
    }
    return http.Response.fromStream(await _client.send(req));
  });

  /// Télécharge un fichier protégé (jeton dans l'en-tête, jamais dans l'URL).
  Future<List<int>> download(String path) async {
    try {
      final r = await _client
          .get(_uri(path), headers: _headers)
          .timeout(const Duration(seconds: 90));
      if (r.statusCode == 200) return r.bodyBytes;
      _handle(r);
      return const [];
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(0, 'Téléchargement impossible.');
    }
  }
}
