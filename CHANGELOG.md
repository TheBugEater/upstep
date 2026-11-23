# Changelog

Notable changes to Upstep are documented here. The project follows semantic
versioning for published SDK packages; the hosted application is released
continuously from `main`.

## Unreleased

### Added

- SDK 0.9.0 (`@upstep/js`, `@upstep/react-native`, `@upstep/types`) and
  `upstep_flutter` 0.3.0: theme the widgets and hosted support chat with
  `colors`, `radius` and (web) `fontFamily`; the default accent follows the
  brand orange per mode.
- SDK 0.10.0 (`@upstep/js`, `@upstep/react-native`, `@upstep/types`) and
  `upstep_flutter` 0.4.0: support chat routes feature requests to the public
  ideas board. The AI shows matching ideas to vote for, or the customer posts
  a new one in their own words, instead of opening a private ticket. With
  support on, every widget shows two tabs, Support and Ideas, and its form
  only suggests ideas.
- SDK 0.11.0 (`@upstep/js`, `@upstep/types`): `feedback: false` (React
  `feedback={false}`, script `data-feedback="false"`) makes a support-chat-only
  web widget. It hides the Ideas tab and feedback form, skips loading ideas,
  and shows no launcher until support chat is confirmed for the project.
- SDK 0.11.1 (`@upstep/js`): the React provider no longer loads ideas when
  `feedback` is false.
- AGPL-licensed self-hostable server distribution and Docker Compose setup.
- `UPSTEP_SELF_HOSTED=true` gives every account on a self-hosted install every
  feature with no plan limits and no billing. Docker Compose turns it on.
- Community health files, CI, dependency review, CodeQL and secret scanning.
- Private, hashed MCP credentials with generate, rotate and revoke controls.
- PostgreSQL-backed rate limiting and durable notification processing.

### Security

- Public SDK keys are no longer accepted by the privileged MCP endpoint.
- Removed an unused password-registration endpoint that was not connected to
  an authentication provider.
