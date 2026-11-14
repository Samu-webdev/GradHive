import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// Session de l'utilisateur : jeton Sanctum (stockage sécurisé du système), profil et langue.
class Session extends ChangeNotifier {
  Session(this.api, {FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage() {
    api.onUnauthorized = () => expire();
  }

  final ApiClient api;
  final FlutterSecureStorage _storage;
  Map<String, dynamic>? user;
  DateTime? expiresAt;
  String locale = 'fr';
  bool ready = false;
  bool expired = false;

  bool get isLoggedIn => user != null && api.token != null;
  String? get role => user?['role'] as String?;
  int? get userId => user?['id'] as int?;
  bool hasRole(List<String> roles) => isLoggedIn && roles.contains(role);
  bool get isFr => locale == 'fr';

  /// Charge la session enregistrée ; un jeton expiré est oublié.
  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    locale = prefs.getString('locale') ?? 'fr';
    try {
      final token = await _storage.read(key: 'token');
      final u = await _storage.read(key: 'user');
      final exp = await _storage.read(key: 'expires_at');
      final expDate = exp == null ? null : DateTime.tryParse(exp);
      if (token != null &&
          u != null &&
          (expDate == null || expDate.isAfter(DateTime.now()))) {
        api.token = token;
        user = jsonDecode(u) as Map<String, dynamic>;
        expiresAt = expDate;
        refreshProfile();
      } else if (token != null) {
        await _clearStorage();
      }
    } catch (_) {
      await _clearStorage();
    }
    ready = true;
    notifyListeners();
  }

  Future<void> refreshProfile() async {
    try {
      final r = await api.get('/me');
      user = Map<String, dynamic>.from(r['user'] as Map);
      await _storage.write(key: 'user', value: jsonEncode(user));
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _store(Map r) async {
    api.token = r['token'] as String?;
    user = Map<String, dynamic>.from(r['user'] as Map);
    expiresAt = r['expires_at'] == null
        ? null
        : DateTime.tryParse('${r['expires_at']}');
    expired = false;
    await _storage.write(key: 'token', value: api.token);
    await _storage.write(key: 'user', value: jsonEncode(user));
    await _storage.write(
      key: 'expires_at',
      value: expiresAt?.toIso8601String(),
    );
    notifyListeners();
  }

  Future<void> login(String email, String password) async => _store(
    await api.post('/login', {'email': email, 'password': password}) as Map,
  );

  Future<void> register(Map<String, dynamic> body) async =>
      _store(await api.post('/register', body) as Map);

  Future<void> logout() async {
    try {
      if (api.token != null) await api.post('/logout');
    } catch (_) {}
    await _clear();
  }

  /// Appelée quand l'API répond 401 avec un jeton : session expirée ou révoquée.
  void expire() {
    if (api.token == null) return;
    expired = true;
    _clear();
  }

  Future<void> _clearStorage() async {
    try {
      await _storage.deleteAll();
    } catch (_) {}
  }

  Future<void> _clear() async {
    api.token = null;
    user = null;
    expiresAt = null;
    await _clearStorage();
    notifyListeners();
  }

  Future<void> setLocale(String l) async {
    locale = l;
    (await SharedPreferences.getInstance()).setString('locale', l);
    notifyListeners();
  }
}
