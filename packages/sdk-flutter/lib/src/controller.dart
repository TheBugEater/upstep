import 'dart:async';

import 'package:flutter/material.dart';

import 'api_client.dart';
import 'config.dart';
import 'theme.dart';
import 'models.dart';
import 'support_client.dart';

class UpstepController extends ChangeNotifier {
  UpstepController({required UpstepConfig config, UpstepApiClient? client})
    : _config = config,
      _client = client ?? UpstepApiClient(config),
      support = SupportClient(config);

  final UpstepApiClient _client;
  final SupportClient support;
  Map<String, dynamic>? supportConfig;
  int supportRevision = 0;
  bool _disposed = false;
  UpstepConfig _config;

  List<FeedbackItem> _feedItems = const <FeedbackItem>[];
  bool _feedLoading = true;
  bool _showBranding = true;
  bool _isOpen = false;
  Object? _lastError;
  bool _initialized = false;

  UpstepApiClient get client => _client;
  List<FeedbackItem> get feedItems => _feedItems;
  bool get feedLoading => _feedLoading;
  bool get showBranding => _showBranding;
  bool get isOpen => _isOpen;
  Object? get lastError => _lastError;
  Color get accentColor => _config.accentColor ?? const Color(0xFFD97757);
  UpstepThemeMode get themeMode => _config.themeMode;
  UpstepColors? get colors => _config.colors;
  double? get radius => _config.radius;

  /// The resolved look for [brightness]: defaults, then [colors] and [radius].
  UpstepThemeData themeFor(Brightness brightness) => UpstepThemeData.resolve(
    brightness: brightness,
    accent: accentColor,
    colors: colors,
    radius: radius,
  );
  String? get userId => _client.userId;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    await _client.initialize();
    await Future.wait([loadFeed(), loadSupport()]);
  }

  Future<void> loadSupport() async {
    try {
      supportConfig = _config.chat ? await support.configuration() : null;
    } catch (_) {
      supportConfig = null;
    }
    if (!_disposed) notifyListeners();
  }

  Future<void> identifySupport(String? token) async {
    _config = _config.copyWith(
      supportIdentityToken: token,
      clearSupportIdentity: token == null,
    );
    supportRevision++;
    await support.identify(token);
    if (!_disposed) notifyListeners();
  }

  Future<void> loadFeed() async {
    _feedLoading = true;
    _lastError = null;
    notifyListeners();
    try {
      final data = await _client.listFeedback(limit: 30, sort: 'votes');
      _feedItems = data.items;
      _showBranding = data.showBranding;
    } catch (error) {
      _lastError = error;
    } finally {
      _feedLoading = false;
      notifyListeners();
    }
  }

  Future<void> submit({
    String? title,
    required String content,
    FeedbackType type = FeedbackType.general,
  }) async {
    await _client.submitFeedback(title: title, content: content, type: type);
    await loadFeed();
  }

  Future<void> vote(String feedbackId, VoteValue value) async {
    final snapshot = _feedItems;
    _feedItems =
        _feedItems
            .map(
              (FeedbackItem item) =>
                  item.id == feedbackId ? _optimisticVote(item, value) : item,
            )
            .toList()
          ..sort(
            (FeedbackItem a, FeedbackItem b) => b.upvotes.compareTo(a.upvotes),
          );
    notifyListeners();

    try {
      await _client.vote(feedbackId, value);
    } catch (error) {
      _feedItems = snapshot;
      _lastError = error;
      notifyListeners();
      rethrow;
    }
  }

  Future<FeedbackDetail> getItem(String feedbackId) {
    return _client.getItem(feedbackId);
  }

  void identify(String? nextUserId) {
    _client.setUserId(nextUserId);
    notifyListeners();
  }

  void updateConfig(UpstepConfig config) {
    final identityChanged =
        _config.supportIdentityToken != config.supportIdentityToken;
    final chatChanged = _config.chat != config.chat;
    _config = config;
    if (identityChanged) {
      unawaited(identifySupport(config.supportIdentityToken));
    }
    if (chatChanged) unawaited(loadSupport());
    _client.setUserId(config.userId);
    notifyListeners();
  }

  void openSheet() {
    if (_isOpen) return;
    _isOpen = true;
    notifyListeners();
  }

  void closeSheet() {
    if (!_isOpen) return;
    _isOpen = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    support.dispose();
    _client.dispose();
    super.dispose();
  }
}

FeedbackItem _optimisticVote(FeedbackItem item, VoteValue value) {
  if (value == VoteValue.up) {
    if (item.userVote == VoteValue.up) {
      return item.copyWith(
        upvotes: item.upvotes > 0 ? item.upvotes - 1 : 0,
        clearVote: true,
      );
    }

    var downvotes = item.downvotes;
    if (item.userVote == VoteValue.down && downvotes > 0) {
      downvotes -= 1;
    }
    return item.copyWith(
      upvotes: item.upvotes + 1,
      downvotes: downvotes,
      userVote: VoteValue.up,
    );
  }

  if (item.userVote == VoteValue.down) {
    return item.copyWith(
      downvotes: item.downvotes > 0 ? item.downvotes - 1 : 0,
      clearVote: true,
    );
  }

  var upvotes = item.upvotes;
  if (item.userVote == VoteValue.up && upvotes > 0) {
    upvotes -= 1;
  }
  return item.copyWith(
    upvotes: upvotes,
    downvotes: item.downvotes + 1,
    userVote: VoteValue.down,
  );
}
