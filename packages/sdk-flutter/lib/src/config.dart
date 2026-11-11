import 'package:flutter/material.dart';

import 'theme.dart';

enum UpstepThemeMode { light, dark, auto }

@immutable
class UpstepConfig {
  const UpstepConfig({
    required this.apiKey,
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

  /// Panel color overrides. Null fields keep the default palette.
  final UpstepColors? colors;

  /// Base corner radius in logical pixels. Defaults to 12; the sheet,
  /// bubbles and buttons scale with it and 0 gives square corners.
  /// Clamped to 0–32.
  final double? radius;

  UpstepConfig copyWith({
    String? apiKey,
    String? userId,
    bool? chat,
    String? supportIdentityToken,
    bool clearSupportIdentity = false,
    String? baseUrl,
    Color? accentColor,
    UpstepThemeMode? themeMode,
    UpstepColors? colors,
    double? radius,
  }) {
    return UpstepConfig(
      apiKey: apiKey ?? this.apiKey,
      userId: userId ?? this.userId,
      chat: chat ?? this.chat,
      supportIdentityToken: clearSupportIdentity
          ? null
          : supportIdentityToken ?? this.supportIdentityToken,
      baseUrl: baseUrl ?? this.baseUrl,
      accentColor: accentColor ?? this.accentColor,
      themeMode: themeMode ?? this.themeMode,
      colors: colors ?? this.colors,
      radius: radius ?? this.radius,
    );
  }
}
