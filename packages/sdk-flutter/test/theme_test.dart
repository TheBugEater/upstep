import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:upstep_flutter/upstep_flutter.dart';

void main() {
  const accent = Color(0xFFD97757);

  test('defaults are unchanged when nothing is overridden', () {
    final light = UpstepThemeData.resolve(
      brightness: Brightness.light,
      accent: accent,
    );
    expect(light.background, Colors.white);
    expect(light.surface, const Color(0xFFF5F5F5));
    expect(light.cardFill, const Color(0xFFFAFAFA));
    expect(light.border, const Color(0xFFE5E5E5));
    expect(light.text, const Color(0xFF404040));
    expect(light.textMuted, isNull);
    expect(light.accentText, const Color(0xFFFFFFFF));
    expect(light.radius, 12);
    expect(light.corners(18), BorderRadius.circular(18));

    final dark = UpstepThemeData.resolve(
      brightness: Brightness.dark,
      accent: accent,
    );
    expect(dark.background, Colors.black);
    expect(dark.border, const Color(0xFF404040));
  });

  test('mode-specific colors win over shared ones', () {
    const colors = UpstepColors(
      border: Color(0xFFE2E8F0),
      text: Color(0xFF0F172A),
      dark: UpstepColors(
        background: Color(0xFF0F172A),
        text: Color(0xFFF8FAFC),
      ),
    );
    final light = colors.resolve(Brightness.light);
    expect(light.text, const Color(0xFF0F172A));
    expect(light.background, isNull);
    final dark = UpstepThemeData.resolve(
      brightness: Brightness.dark,
      accent: accent,
      colors: colors,
      radius: 0,
    );
    expect(dark.background, const Color(0xFF0F172A));
    expect(dark.text, const Color(0xFFF8FAFC));
    expect(dark.border, const Color(0xFFE2E8F0));
    expect(dark.corners(18), BorderRadius.zero);
  });

  test('accent text stays readable', () {
    expect(readableTextOn(accent), const Color(0xFFFFFFFF));
    expect(readableTextOn(const Color(0xFFE05A33)), const Color(0xFFFFFFFF));
    expect(readableTextOn(const Color(0xFFFACC15)), const Color(0xFF1A1915));
    final custom = UpstepThemeData.resolve(
      brightness: Brightness.light,
      accent: const Color(0xFFFACC15),
      colors: const UpstepColors(accentText: Color(0xFF000000)),
    );
    expect(custom.accentText, const Color(0xFF000000));
  });

  test('the default accent follows the mode', () {
    const config = UpstepConfig(apiKey: 'k');
    final controller = UpstepController(config: config);
    expect(controller.accentFor(Brightness.light), upstepAccentLight);
    expect(controller.accentFor(Brightness.dark), upstepAccentDark);
    expect(readableTextOn(upstepAccentLight), const Color(0xFFFFFFFF));
    expect(readableTextOn(upstepAccentDark), const Color(0xFF1A1915));
    final custom = UpstepController(
      config: config.copyWith(accentColor: const Color(0xFF4F46E5)),
    );
    expect(custom.accentFor(Brightness.dark), const Color(0xFF4F46E5));
  });

  test('radius is clamped', () {
    expect(clampUpstepRadius(null), 12);
    expect(clampUpstepRadius(-5), 0);
    expect(clampUpstepRadius(80), 32);
    expect(clampUpstepRadius(double.nan), 12);
  });

  test('config copyWith keeps and replaces theme fields', () {
    const colors = UpstepColors(background: Color(0xFF0F172A));
    const config = UpstepConfig(apiKey: 'k', colors: colors, radius: 8);
    expect(config.copyWith(userId: 'u').colors, colors);
    expect(config.copyWith(userId: 'u').radius, 8);
    expect(config.copyWith(radius: 4).radius, 4);
    expect(
      UpstepController(config: config).themeFor(Brightness.light).background,
      const Color(0xFF0F172A),
    );
  });
}
