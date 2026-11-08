import 'package:flutter/material.dart';

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
  });

  final String apiKey;
  final String? userId;
  final bool chat;
  final String? supportIdentityToken;
  final String baseUrl;
  final Color? accentColor;
  final UpstepThemeMode themeMode;

  UpstepConfig copyWith({
    String? apiKey,
    String? userId,
    bool? chat,
    String? supportIdentityToken,
    bool clearSupportIdentity = false,
    String? baseUrl,
    Color? accentColor,
    UpstepThemeMode? themeMode,
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
    );
  }
}
