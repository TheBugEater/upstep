import 'package:flutter/widgets.dart';

import 'config.dart';
import 'controller.dart';
import 'theme.dart';

class Upstep extends StatefulWidget {
  const Upstep({
    super.key,
    required this.apiKey,
    required this.child,
    this.userId,
    this.chat = true,
    this.supportIdentityToken,
    this.baseUrl = 'https://upstep.dev',
    this.accentColor,
    this.themeMode = UpstepThemeMode.auto,
    this.colors,
    this.radius,
  });

  final String apiKey;
  final String? userId;
  final bool chat;
  final String? supportIdentityToken;
  final String baseUrl;
  final Color? accentColor;
  final UpstepThemeMode themeMode;

  /// Panel color overrides. See [UpstepColors].
  final UpstepColors? colors;

  /// Base corner radius in logical pixels. Defaults to 12.
  final double? radius;
  final Widget child;

  static UpstepController of(BuildContext context, {bool listen = true}) {
    final inherited = listen
        ? context.dependOnInheritedWidgetOfExactType<_UpstepScope>()
        : context.getInheritedWidgetOfExactType<_UpstepScope>();
    final controller = inherited?.controller;
    if (controller == null) {
      throw FlutterError('Upstep.of() called without an Upstep ancestor.');
    }
    return controller;
  }

  @override
  State<Upstep> createState() => _UpstepState();
}

class _UpstepState extends State<Upstep> {
  late final UpstepController _controller;

  @override
  void initState() {
    super.initState();
    _controller = UpstepController(config: _configFromWidget());
    _controller.initialize();
  }

  @override
  void didUpdateWidget(covariant Upstep oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.apiKey != widget.apiKey ||
        oldWidget.baseUrl != widget.baseUrl) {
      throw FlutterError(
        'Changing apiKey or baseUrl after Upstep is mounted is not supported yet. '
        'Rebuild the Upstep widget with a new key instead.',
      );
    }
    if (oldWidget.userId != widget.userId ||
        oldWidget.accentColor != widget.accentColor ||
        oldWidget.themeMode != widget.themeMode ||
        oldWidget.colors != widget.colors ||
        oldWidget.radius != widget.radius ||
        oldWidget.chat != widget.chat ||
        oldWidget.supportIdentityToken != widget.supportIdentityToken) {
      _controller.updateConfig(_configFromWidget());
    }
  }

  UpstepConfig _configFromWidget() {
    return UpstepConfig(
      apiKey: widget.apiKey,
      userId: widget.userId,
      chat: widget.chat,
      supportIdentityToken: widget.supportIdentityToken,
      baseUrl: widget.baseUrl,
      accentColor: widget.accentColor,
      themeMode: widget.themeMode,
      colors: widget.colors,
      radius: widget.radius,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _UpstepScope(controller: _controller, child: widget.child);
  }
}

class _UpstepScope extends InheritedNotifier<UpstepController> {
  const _UpstepScope({required this.controller, required super.child})
    : super(notifier: controller);

  final UpstepController controller;
}
