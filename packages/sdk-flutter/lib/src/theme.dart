import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Colors you can override in the Upstep widgets. Every field is optional:
/// a null field keeps the built-in light or dark palette.
///
/// Top-level fields apply in both modes; [light] and [dark] refine one mode
/// and win over the top-level fields:
///
/// ```dart
/// UpstepColors(
///   border: Color(0xFFE2E8F0),
///   light: UpstepColors(background: Color(0xFFF8FAFC)),
///   dark: UpstepColors(background: Color(0xFF0F172A)),
/// )
/// ```
@immutable
class UpstepColors {
  const UpstepColors({
    this.background,
    this.surface,
    this.border,
    this.text,
    this.textMuted,
    this.accentText,
    this.light,
    this.dark,
  });

  /// Panel background.
  final Color? background;

  /// Inputs, chat bubbles and other soft fills.
  final Color? surface;

  /// Hairlines and input borders.
  final Color? border;

  /// Primary text.
  final Color? text;

  /// Secondary text: hints, timestamps, placeholders.
  final Color? textMuted;

  /// Text and icons on the accent color. Picked automatically when null.
  final Color? accentText;

  /// Overrides for light mode only.
  final UpstepColors? light;

  /// Overrides for dark mode only.
  final UpstepColors? dark;

  /// Top-level colors with the [brightness]'s own overrides on top.
  UpstepColors resolve(Brightness brightness) {
    final mode = brightness == Brightness.dark ? dark : light;
    return UpstepColors(
      background: mode?.background ?? background,
      surface: mode?.surface ?? surface,
      border: mode?.border ?? border,
      text: mode?.text ?? text,
      textMuted: mode?.textMuted ?? textMuted,
      accentText: mode?.accentText ?? accentText,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is UpstepColors &&
      other.background == background &&
      other.surface == surface &&
      other.border == border &&
      other.text == text &&
      other.textMuted == textMuted &&
      other.accentText == accentText &&
      other.light == light &&
      other.dark == dark;

  @override
  int get hashCode => Object.hash(
    background,
    surface,
    border,
    text,
    textMuted,
    accentText,
    light,
    dark,
  );
}

/// Default base corner radius. Every corner in the widgets scales from it.
const double upstepDefaultRadius = 12;

/// Clamps a radius to 0–32. Null or non-finite values give the default.
double clampUpstepRadius(double? radius) {
  if (radius == null || !radius.isFinite) return upstepDefaultRadius;
  return radius.clamp(0, 32).roundToDouble();
}

double _luminance(Color color) => color.computeLuminance();

double _contrast(Color a, Color b) {
  final x = _luminance(a);
  final y = _luminance(b);
  return (math.max(x, y) + 0.05) / (math.min(x, y) + 0.05);
}

/// Text color for a filled accent: white while it keeps 3:1 contrast,
/// otherwise whichever of white or near-black reads better.
Color readableTextOn(Color background) {
  const white = Color(0xFFFFFFFF);
  const ink = Color(0xFF1A1915);
  final onWhite = _contrast(background, white);
  if (onWhite >= 3) return white;
  return _contrast(background, ink) > onWhite ? ink : white;
}

/// Resolved Upstep look, carried on the [Theme] so the sheet and the
/// support chat share it. Wrap a standalone [SupportChat] in a [Theme] with
/// this extension to theme it outside the feedback sheet.
@immutable
class UpstepThemeData extends ThemeExtension<UpstepThemeData> {
  const UpstepThemeData({
    required this.background,
    required this.surface,
    required this.cardFill,
    required this.border,
    required this.text,
    required this.textMuted,
    required this.accentText,
    required this.radius,
  });

  /// Defaults for [brightness] with any [colors] on top.
  factory UpstepThemeData.resolve({
    required Brightness brightness,
    required Color accent,
    UpstepColors? colors,
    double? radius,
  }) {
    final dark = brightness == Brightness.dark;
    final o = colors?.resolve(brightness) ?? const UpstepColors();
    final background = o.background ?? (dark ? Colors.black : Colors.white);
    final text =
        o.text ?? (dark ? const Color(0xFFE5E5E5) : const Color(0xFF404040));
    return UpstepThemeData(
      background: background,
      surface:
          o.surface ??
          (dark ? const Color(0xFF171717) : const Color(0xFFF5F5F5)),
      cardFill:
          o.surface ??
          (dark ? const Color(0xFF171717) : const Color(0xFFFAFAFA)),
      border:
          o.border ??
          (dark ? const Color(0xFF404040) : const Color(0xFFE5E5E5)),
      text: text,
      textMuted: o.textMuted,
      accentText: o.accentText ?? readableTextOn(accent),
      radius: clampUpstepRadius(radius),
    );
  }

  /// The look on the nearest [Theme], or the defaults for its brightness.
  static UpstepThemeData of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<UpstepThemeData>() ??
        UpstepThemeData.resolve(
          brightness: theme.brightness,
          accent: theme.colorScheme.primary,
        );
  }

  final Color background;
  final Color surface;

  /// Fill for forms and cards inside the chat.
  final Color cardFill;
  final Color border;
  final Color text;

  /// Null keeps the Material default for secondary text.
  final Color? textMuted;
  final Color accentText;

  /// Base corner radius in logical pixels.
  final double radius;

  /// Scales one of the widgets' built-in radii (designed for 12) to [radius].
  double scale(double designed) => designed * radius / upstepDefaultRadius;

  /// A circular [BorderRadius] scaled from a built-in radius.
  BorderRadius corners(double designed) =>
      BorderRadius.circular(scale(designed));

  @override
  UpstepThemeData copyWith({
    Color? background,
    Color? surface,
    Color? cardFill,
    Color? border,
    Color? text,
    Color? textMuted,
    Color? accentText,
    double? radius,
  }) => UpstepThemeData(
    background: background ?? this.background,
    surface: surface ?? this.surface,
    cardFill: cardFill ?? this.cardFill,
    border: border ?? this.border,
    text: text ?? this.text,
    textMuted: textMuted ?? this.textMuted,
    accentText: accentText ?? this.accentText,
    radius: radius ?? this.radius,
  );

  @override
  UpstepThemeData lerp(UpstepThemeData? other, double t) {
    if (other == null) return this;
    return UpstepThemeData(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      cardFill: Color.lerp(cardFill, other.cardFill, t)!,
      border: Color.lerp(border, other.border, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t),
      accentText: Color.lerp(accentText, other.accentText, t)!,
      radius: radius + (other.radius - radius) * t,
    );
  }
}
