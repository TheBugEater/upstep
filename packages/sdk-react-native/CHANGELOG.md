# Changelog

## 0.9.0

- Theme the sheet and support chat to your brand with `colors` (`background`, `surface`, `border`, `text`, `textMuted`, `accentText`, plus `light` / `dark` variants) and `radius`. Unset keys keep the defaults.
- Text on the accent is picked for contrast when `accentText` isn't set.
- The default accent now matches the Upstep brand per mode: `#C9481F` on light, `#FF7A50` with dark text on dark. Set `accentColor` to keep a single color.
- `SupportView` takes `colors` and `radius` when used on its own.

## 0.8.0

- Redesigned support chat: neutral message bubbles with AI and team tags, a labelled quick-reply tray with accent-tinted chips, and follow-up forms that open from "Talk to a person" or "Add details" only when the AI offers them.
- Compact one-row header. Ticket reference moves into the status line, and email, branding and alert settings move into a "•••" panel.
- Unread replies: a count badge on `FeedbackButton`, a "NEW" divider and "N new" jump pill in the chat, a short vibration for new messages, and `useUpstep().supportUnread` for custom launchers.
- New `onSupportMessage` option on `FeedbackProvider`, called when a reply arrives while the chat is closed. Use it to play a sound or schedule a local notification.

## 0.7.2

- Show the business icon selected during website-based support setup.

## 0.7.1

- Restore the original accent and use the configured accent for all chat actions.
- Compact text and action cards pinned near the composer, with two-step contact collection and expandable optional details.

## 0.7.0

- Native support chat in the existing feedback sheet, with signed customer identities and anonymous session persistence.
- Quick replies, issue forms, resolution checks and a required contact card before team handoff.
- Larger text, softer colors and white/black themes.

## 0.6.16

- Fix TypeScript compatibility across React Native versions when rendering the feedback-sheet backdrop.

## 0.6.15

- Show the custom dashboard status name and color in the feedback sheet.

## 0.6.14

- Show dashboard custom labels on feedback cards and detail views.
