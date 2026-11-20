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
- AGPL-licensed self-hostable server distribution and Docker Compose setup.
- Community health files, CI, dependency review, CodeQL and secret scanning.
- Private, hashed MCP credentials with generate, rotate and revoke controls.
- PostgreSQL-backed rate limiting and durable notification processing.

### Security

- Public SDK keys are no longer accepted by the privileged MCP endpoint.
- Removed an unused password-registration endpoint that was not connected to
  an authentication provider.
