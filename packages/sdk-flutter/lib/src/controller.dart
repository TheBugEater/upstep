import 'dart:async';

import 'package:flutter/material.dart';

import 'api_client.dart';
import 'config.dart';
import 'models.dart';

class UpstepController extends ChangeNotifier {
  UpstepController({required UpstepConfig config, UpstepApiClient? client})
    : _config = config,
      _client = client ?? UpstepApiClient(config);

  final UpstepApiClient _client;
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
  String? get userId => _client.userId;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    await _client.initialize();
    await loadFeed();
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
    _config = config;
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
