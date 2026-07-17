import 'package:flutter/material.dart';

enum UpstepThemeMode { light, dark, auto }

@immutable
class UpstepConfig {
  const UpstepConfig({
    required this.apiKey,
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

  UpstepConfig copyWith({
    String? apiKey,
    String? userId,
    String? baseUrl,
    Color? accentColor,
    UpstepThemeMode? themeMode,
  }) {
    return UpstepConfig(
      apiKey: apiKey ?? this.apiKey,
      userId: userId ?? this.userId,
      baseUrl: baseUrl ?? this.baseUrl,
      accentColor: accentColor ?? this.accentColor,
      themeMode: themeMode ?? this.themeMode,
    );
  }
}
