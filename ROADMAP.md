# Roadmap

This roadmap communicates direction rather than fixed delivery dates. Proposals
and pull requests are welcome.

## Reliability

- Expand database-backed integration tests for authorization, voting races,
  notification retries and Stripe webhooks.
- Add backup/restore documentation and a production operations runbook.
- Add idempotency keys for external webhook deliveries.

## Self-hosting

- Publish versioned container images and signed release artifacts.
- Add SMTP as an alternative to Resend.
- Support more authentication options without requiring a hosted provider.

## Product

- Feedback export and account-level data export.
- Scoped, expiring MCP keys and read-only agent roles.
- Audit logs and stronger project member roles.
- Importers for common feedback platforms.

Hosted-only operational services such as managed backups, upgrades and support
may be sold commercially while the application source remains open.
