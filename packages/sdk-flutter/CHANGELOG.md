# Changelog

## 0.3.0

- Theme the sheet and support chat to your brand with `colors: UpstepColors(...)` (with `light` / `dark` variants) and `radius`, on `Upstep` and `UpstepConfig`.
- Text on the accent is picked for contrast when `accentText` isn't set.
- The default accent now matches the Upstep brand per mode: `#C9481F` on light, `#FF7A50` with dark text on dark. Set `accentColor` to keep a single color.
- New `UpstepThemeData` theme extension, so a standalone `SupportChat` can be themed.

## 0.2.1

- Restore the original accent and apply the configured theme color to support actions.
- Show the approved business icon from support setup.
- Compact text and action cards pinned near the composer, with two-step contact collection and expandable optional details.

## 0.2.0

- Native AI and team chat inside the existing feedback sheet.
- Quick replies, issue forms, resolution checks and contact details before handoff.
- Private session persistence, signed customer identities and deduplicated message retries.
- Readable text and softer chat surfaces.

## 0.1.2

- Show the custom dashboard status name and color in the feedback sheet.

## 0.1.1

- Show dashboard custom labels on feedback cards and detail views.

## 0.1.0

- Initial Flutter SDK release
- Added `Upstep` provider, `UpstepController`, and HTTP client
- Added `FeedbackButton` and `FeedbackSheet` widgets
- Added anonymous-id persistence and `identify(userId)` support
