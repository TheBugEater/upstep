import 'package:flutter/widgets.dart';

import 'config.dart';
import 'controller.dart';

class Upstep extends StatefulWidget {
  const Upstep({
    super.key,
    required this.apiKey,
    required this.child,
    this.userId,
    this.baseUrl = 'https://upstep.dev',
    this.accentColor,
    this.themeMode = UpstepThemeMode.auto,
  });

  final String apiKey;
  final String? userId;
  final String baseUrl;
  final Color? accentColor;
  final UpstepThemeMode themeMode;
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
        oldWidget.themeMode != widget.themeMode) {
      _controller.updateConfig(_configFromWidget());
    }
  }

  UpstepConfig _configFromWidget() {
    return UpstepConfig(
      apiKey: widget.apiKey,
      userId: widget.userId,
      baseUrl: widget.baseUrl,
      accentColor: widget.accentColor,
      themeMode: widget.themeMode,
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
