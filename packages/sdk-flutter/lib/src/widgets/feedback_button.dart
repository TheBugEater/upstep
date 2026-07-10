import 'package:flutter/material.dart';

import '../provider.dart';

enum FeedbackButtonPosition { bottomLeft, bottomRight }

class FeedbackButton extends StatelessWidget {
  const FeedbackButton({
    super.key,
    this.position = FeedbackButtonPosition.bottomRight,
    this.label = 'Feedback',
    this.icon = const Icon(Icons.chat_bubble_outline),
    this.margin = const EdgeInsets.all(16),
  });

  final FeedbackButtonPosition position;
  final String label;
  final Widget icon;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    final upstep = Upstep.of(context);
    final alignment = position == FeedbackButtonPosition.bottomLeft
        ? Alignment.bottomLeft
        : Alignment.bottomRight;

    return IgnorePointer(
      ignoring: false,
      child: SafeArea(
        child: Align(
          alignment: alignment,
          child: Padding(
            padding: margin,
            child: FloatingActionButton.extended(
              heroTag: null,
              backgroundColor: upstep.accentColor,
              foregroundColor: Colors.white,
              onPressed: upstep.openSheet,
              icon: icon,
              label: Text(label),
            ),
          ),
        ),
      ),
    );
  }
}
