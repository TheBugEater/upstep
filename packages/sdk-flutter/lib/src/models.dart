enum FeedbackType { bug, feature, general }

enum FeedbackStatus { pending, open, inProgress, done, closed }

enum VoteValue { up, down }

extension FeedbackTypeWire on FeedbackType {
  String get wireName {
    switch (this) {
      case FeedbackType.bug:
        return 'BUG';
      case FeedbackType.feature:
        return 'FEATURE';
      case FeedbackType.general:
        return 'GENERAL';
    }
  }

  String get label {
    switch (this) {
      case FeedbackType.bug:
        return 'Bug';
      case FeedbackType.feature:
        return 'Feature';
      case FeedbackType.general:
        return 'General';
    }
  }
}

extension FeedbackStatusWire on FeedbackStatus {
  static FeedbackStatus fromWire(String value) {
    switch (value) {
      case 'PENDING':
        return FeedbackStatus.pending;
      case 'OPEN':
        return FeedbackStatus.open;
      case 'IN_PROGRESS':
        return FeedbackStatus.inProgress;
      case 'DONE':
        return FeedbackStatus.done;
      case 'CLOSED':
        return FeedbackStatus.closed;
      default:
        return FeedbackStatus.open;
    }
  }
}

extension VoteValueWire on VoteValue {
  String get wireName {
    switch (this) {
      case VoteValue.up:
        return 'UP';
      case VoteValue.down:
        return 'DOWN';
    }
  }

  static VoteValue? fromWire(String? value) {
    switch (value) {
      case 'UP':
        return VoteValue.up;
      case 'DOWN':
        return VoteValue.down;
      default:
        return null;
    }
  }
}

class Label {
  Label({required this.id, required this.name, required this.color});

  final String id;
  final String name;
  final String color;

  factory Label.fromJson(Map<String, dynamic> json) {
    return Label(
      id: json['id'] as String,
      name: json['name'] as String,
      color: json['color'] as String,
    );
  }
}

class FeedbackItem {
  FeedbackItem({
    required this.id,
    required this.projectId,
    required this.content,
    required this.type,
    required this.status,
    required this.upvotes,
    required this.downvotes,
    required this.createdAt,
    this.title,
    this.endUserId,
    this.anonymousId,
    this.flagged,
    this.internal,
    this.labels = const <Label>[],
    this.metadata = const <String, dynamic>{},
    this.userVote,
  });

  final String id;
  final String projectId;
  final String? title;
  final String content;
  final FeedbackType type;
  final FeedbackStatus status;
  final String? endUserId;
  final String? anonymousId;
  final int upvotes;
  final int downvotes;
  final bool? flagged;
  final bool? internal;
  final List<Label> labels;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;
  final VoteValue? userVote;

  factory FeedbackItem.fromJson(Map<String, dynamic> json) {
    return FeedbackItem(
      id: json['id'] as String,
      projectId: json['projectId'] as String,
      title: json['title'] as String?,
      content: json['content'] as String,
      type: _feedbackTypeFromWire(json['type'] as String?),
      status: FeedbackStatusWire.fromWire(json['status'] as String? ?? 'OPEN'),
      endUserId: json['endUserId'] as String?,
      anonymousId: json['anonymousId'] as String?,
      upvotes: (json['upvotes'] as num?)?.toInt() ?? 0,
      downvotes: (json['downvotes'] as num?)?.toInt() ?? 0,
      flagged: json['flagged'] as bool?,
      internal: json['internal'] as bool?,
      labels: ((json['labels'] as List<dynamic>?) ?? const <dynamic>[])
          .map((dynamic item) => Label.fromJson(item as Map<String, dynamic>))
          .toList(),
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
      createdAt: DateTime.parse(json['createdAt'] as String),
      userVote: VoteValueWire.fromWire(json['userVote'] as String?),
    );
  }

  FeedbackItem copyWith({
    String? title,
    String? content,
    FeedbackType? type,
    FeedbackStatus? status,
    int? upvotes,
    int? downvotes,
    VoteValue? userVote,
    bool clearVote = false,
  }) {
    return FeedbackItem(
      id: id,
      projectId: projectId,
      title: title ?? this.title,
      content: content ?? this.content,
      type: type ?? this.type,
      status: status ?? this.status,
      endUserId: endUserId,
      anonymousId: anonymousId,
      upvotes: upvotes ?? this.upvotes,
      downvotes: downvotes ?? this.downvotes,
      flagged: flagged,
      internal: internal,
      labels: labels,
      metadata: metadata,
      createdAt: createdAt,
      userVote: clearVote ? null : userVote ?? this.userVote,
    );
  }
}

class CommentItem {
  CommentItem({
    required this.id,
    required this.feedbackId,
    required this.content,
    required this.authorName,
    required this.isOwner,
    required this.createdAt,
  });

  final String id;
  final String feedbackId;
  final String content;
  final String? authorName;
  final bool isOwner;
  final DateTime createdAt;

  factory CommentItem.fromJson(Map<String, dynamic> json) {
    return CommentItem(
      id: json['id'] as String,
      feedbackId: json['feedbackId'] as String,
      content: json['content'] as String,
      authorName: json['authorName'] as String?,
      isOwner: json['isOwner'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class FeedbackDetail extends FeedbackItem {
  FeedbackDetail({
    required super.id,
    required super.projectId,
    required super.content,
    required super.type,
    required super.status,
    required super.upvotes,
    required super.downvotes,
    required super.createdAt,
    required this.comments,
    super.title,
    super.endUserId,
    super.anonymousId,
    super.flagged,
    super.internal,
    super.labels,
    super.metadata,
    super.userVote,
  });

  final List<CommentItem> comments;

  factory FeedbackDetail.fromJson(Map<String, dynamic> json) {
    final base = FeedbackItem.fromJson(json);
    return FeedbackDetail(
      id: base.id,
      projectId: base.projectId,
      title: base.title,
      content: base.content,
      type: base.type,
      status: base.status,
      endUserId: base.endUserId,
      anonymousId: base.anonymousId,
      upvotes: base.upvotes,
      downvotes: base.downvotes,
      flagged: base.flagged,
      internal: base.internal,
      labels: base.labels,
      metadata: base.metadata,
      createdAt: base.createdAt,
      userVote: base.userVote,
      comments: ((json['comments'] as List<dynamic>?) ?? const <dynamic>[])
          .map(
            (dynamic item) =>
                CommentItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class FeedbackListResponse {
  FeedbackListResponse({
    required this.items,
    required this.nextCursor,
    required this.showBranding,
  });

  final List<FeedbackItem> items;
  final String? nextCursor;
  final bool showBranding;

  factory FeedbackListResponse.fromJson(Map<String, dynamic> json) {
    return FeedbackListResponse(
      items: ((json['items'] as List<dynamic>?) ?? const <dynamic>[])
          .map(
            (dynamic item) =>
                FeedbackItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      nextCursor: json['nextCursor'] as String?,
      showBranding: json['showBranding'] as bool? ?? true,
    );
  }
}

FeedbackType _feedbackTypeFromWire(String? value) {
  switch (value) {
    case 'BUG':
      return FeedbackType.bug;
    case 'FEATURE':
      return FeedbackType.feature;
    case 'GENERAL':
    default:
      return FeedbackType.general;
  }
}
