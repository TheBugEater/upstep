# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Email
`hello@upstep.dev` with the subject `SECURITY` and include:

- the affected route, package or deployment mode;
- reproduction steps or a proof of concept;
- the impact you believe is possible;
- any suggested mitigation.

Do not access data that is not yours, degrade the hosted service, or publish a
vulnerability before a fix is available. We will acknowledge reports as soon
as practical and coordinate disclosure with the reporter.

## Supported versions

Security fixes are applied to the latest release on `main`. Self-hosters should
track releases, apply database migrations and rotate exposed credentials.

## Credential model

Publishable SDK keys are expected to appear in client applications and grant
only public feedback API access. MCP keys are private bearer credentials with
project write access; store them in a password manager or secret store and
never commit them to a repository.
