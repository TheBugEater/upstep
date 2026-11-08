import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'config.dart';

/// A message deduplication identifier, never an authentication credential.
String supportMessageId() {
  final random = Random();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.split('').map((c) {
    if (c != 'x' && c != 'y') return c;
    final value = random.nextInt(16);
    return (c == 'x' ? value : (value & 3) | 8).toRadixString(16);
  }).join();
}

class SupportApiException implements Exception {
  const SupportApiException(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

/// Native support transport. Signed identities are exchanged, never persisted.
class SupportClient {
  SupportClient(UpstepConfig config, {http.Client? client})
    : _config = config,
      _http = client ?? http.Client(),
      _identity = config.supportIdentityToken;
  final UpstepConfig _config;
  final http.Client _http;
  String? _identity;
  String? _token;
  Future<void>? _session;
  int _epoch = 0;
  String get _storageKey =>
      'upstep:support:${_config.baseUrl}:${_config.apiKey}';

  Future<void> identify(String? identity) async {
    if (identity == _identity) return;
    _epoch++;
    _identity = identity;
    _token = null;
    _session = null;
    try {
      await (await SharedPreferences.getInstance()).remove(_storageKey);
    } catch (_) {
      /* memory-only sessions */
    }
  }

  Future<Map<String, dynamic>> _request(
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final uri = Uri.parse(
      '${_config.baseUrl.replaceFirst(RegExp(r'/$'), '')}/api/sdk/support$path',
    );
    final request = http.Request(body == null ? 'GET' : 'POST', uri)
      ..followRedirects = false
      ..headers.addAll({
        'Content-Type': 'application/json',
        'x-api-key': _config.apiKey,
        if (_token != null) 'Authorization': 'Bearer $_token',
      });
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(
      await _http.send(request).timeout(const Duration(seconds: 20)),
    ).timeout(const Duration(seconds: 20));
    Map<String, dynamic> data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw SupportApiException(
        'Could not connect to support.',
        response.statusCode,
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401 && path.isNotEmpty) {
        _token = null;
        try {
          await (await SharedPreferences.getInstance()).remove(_storageKey);
        } catch (_) {
          /* memory-only sessions */
        }
      }
      throw SupportApiException(
        data['error'] is String
            ? data['error'] as String
            : 'Could not connect to support.',
        response.statusCode,
      );
    }
    return data;
  }

  Future<Map<String, dynamic>?> configuration() async {
    try {
      return await _request('');
    } on SupportApiException catch (e) {
      if (e.status == 402 || e.status == 404) return null;
      rethrow;
    }
  }

  Future<void> _ensureSession() async {
    if (_token != null) return;
    if (_session != null) return _session!;
    final epoch = _epoch;
    final identity = _identity;
    final session = () async {
      String? saved;
      if (identity == null) {
        try {
          saved = (await SharedPreferences.getInstance()).getString(
            _storageKey,
          );
        } catch (_) {
          /* memory-only sessions */
        }
      }
      if (epoch != _epoch) {
        throw const SupportApiException(
          'Customer identity changed. Please try again.',
          409,
        );
      }
      if (saved != null) {
        _token = saved;
        return;
      }
      final result = await _request('', {'identityToken': ?identity});
      if (epoch != _epoch) {
        throw const SupportApiException(
          'Customer identity changed. Please try again.',
          409,
        );
      }
      _token = result['token'] as String;
      if (identity == null) {
        try {
          await (await SharedPreferences.getInstance()).setString(
            _storageKey,
            _token!,
          );
        } catch (_) {
          /* memory-only sessions */
        }
      }
    }();
    _session = session;
    try {
      await session;
    } finally {
      if (identical(_session, session)) _session = null;
    }
  }

  Future<List<Map<String, dynamic>>> conversations() async {
    await _ensureSession();
    final result = await _request('/conversations');
    return (result['conversations'] as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> startConversation() async {
    await _ensureSession();
    return _request('/conversations', {});
  }

  Future<Map<String, dynamic>> conversation(String id) async {
    await _ensureSession();
    return _request('/conversations/${Uri.encodeComponent(id)}');
  }

  Future<void> send(String id, String text, {String? clientMessageId}) async {
    await _ensureSession();
    await _request('/conversations/${Uri.encodeComponent(id)}', {
      'action': 'message',
      'content': text,
      'clientMessageId': clientMessageId ?? supportMessageId(),
    });
  }

  Future<void> details(String id, Map<String, dynamic> values) async {
    await _ensureSession();
    await _request('/conversations/${Uri.encodeComponent(id)}', {
      'action': 'details',
      ...values,
      'clientMessageId': values['clientMessageId'] ?? supportMessageId(),
    });
  }

  Future<void> handoff(String id, String name, String email) async {
    await _ensureSession();
    await _request('/conversations/${Uri.encodeComponent(id)}', {
      'action': 'handoff',
      'name': name,
      'email': email,
    });
  }

  void dispose() {
    _epoch++;
    _http.close();
  }
}
