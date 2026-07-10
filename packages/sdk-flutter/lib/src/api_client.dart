import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';
import 'models.dart';

const String _anonymousIdKey = 'upstep-anonymous-id';

class UpstepApiClient {
  UpstepApiClient(UpstepConfig config, {http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client(),
      _baseUrl = config.baseUrl.replaceFirst(RegExp(r'/$'), ''),
      _apiKey = config.apiKey,
      userId = config.userId;

  final http.Client _httpClient;
  final String _baseUrl;
  final String _apiKey;

  String? userId;
  String _anonymousId = _generateId();
  Future<void>? _anonymousIdReady;

  Future<void> initialize() {
    return _anonymousIdReady ??= _loadAnonymousId();
  }

  Future<void> _loadAnonymousId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_anonymousIdKey);
      if (stored != null && stored.isNotEmpty) {
        _anonymousId = stored;
      } else {
        await prefs.setString(_anonymousIdKey, _anonymousId);
      }
    } catch (_) {
      // Storage unavailable: keep the in-memory id for this app session.
    }
  }

  void setUserId(String? nextUserId) {
    userId = nextUserId;
  }

  Future<FeedbackListResponse> listFeedback({
    String? cursor,
    int? limit,
    String sort = 'votes',
  }) async {
    await initialize();
    final query = <String, String>{
      'sort': sort,
      if (cursor case final String cursor) 'cursor': cursor,
      if (limit case final int limit) 'limit': '$limit',
      if (userId case final String userId when userId.isNotEmpty)
        'endUserId': userId,
      'anonymousId': _anonymousId,
    };
    final uri = Uri.parse(
      '$_baseUrl/api/sdk/feedback',
    ).replace(queryParameters: query);
    final response = await _httpClient.get(uri, headers: _headers());
    _throwIfNeeded(response);
    return FeedbackListResponse.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<FeedbackDetail> getItem(String feedbackId) async {
    await initialize();
    final query = <String, String>{
      if (userId case final String userId when userId.isNotEmpty)
        'endUserId': userId,
      'anonymousId': _anonymousId,
    };
    final uri = Uri.parse(
      '$_baseUrl/api/sdk/feedback/$feedbackId',
    ).replace(queryParameters: query);
    final response = await _httpClient.get(uri, headers: _headers());
    _throwIfNeeded(response);
    return FeedbackDetail.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<FeedbackItem> submitFeedback({
    String? title,
    required String content,
    FeedbackType type = FeedbackType.general,
    Map<String, dynamic>? metadata,
  }) async {
    await initialize();
    final body = <String, dynamic>{
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      'content': content,
      'type': type.wireName,
      if (userId case final String userId when userId.isNotEmpty)
        'endUserId': userId,
      'anonymousId': _anonymousId,
      if (metadata != null && metadata.isNotEmpty) 'metadata': metadata,
    };
    final response = await _httpClient.post(
      Uri.parse('$_baseUrl/api/sdk/feedback'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    _throwIfNeeded(response);
    return FeedbackItem.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<void> vote(String feedbackId, VoteValue value) async {
    await initialize();
    final response = await _httpClient.post(
      Uri.parse('$_baseUrl/api/sdk/feedback/$feedbackId/vote'),
      headers: _headers(),
      body: jsonEncode(<String, dynamic>{
        'value': value.wireName,
        if (userId case final String userId when userId.isNotEmpty)
          'endUserId': userId,
        'anonymousId': _anonymousId,
      }),
    );
    _throwIfNeeded(response);
  }

  Map<String, String> _headers() {
    return <String, String>{
      'Content-Type': 'application/json',
      'x-api-key': _apiKey,
    };
  }

  void dispose() {
    _httpClient.close();
  }
}

String _generateId() {
  final now = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
  final random = Random().nextInt(1 << 32).toRadixString(36);
  return '$now-$random';
}

void _throwIfNeeded(http.Response response) {
  if (response.statusCode >= 200 && response.statusCode < 300) return;

  try {
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final error = decoded['error'];
    if (error is String && error.isNotEmpty) {
      throw UpstepException('Upstep: ${response.statusCode} $error');
    }
  } catch (_) {
    // Fall back to generic status text below.
  }
  throw UpstepException('Upstep: ${response.statusCode}');
}

class UpstepException implements Exception {
  UpstepException(this.message);

  final String message;

  @override
  String toString() => message;
}
