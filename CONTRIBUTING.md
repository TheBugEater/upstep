# Contributing to Upstep

Thanks for helping improve Upstep. Small, focused pull requests are easiest to
review.

## Development

1. Install Node.js 20 or later and enable Corepack.
2. Run `pnpm install`.
3. Copy `apps/web/.env.example` to `apps/web/.env`.
4. Start PostgreSQL with `docker compose up -d postgres`.
5. Apply migrations with `pnpm --filter @upstep/web exec prisma migrate deploy`.
6. Run `pnpm dev`.

Before opening a pull request, run:

```bash
pnpm type-check
pnpm test
pnpm build
```

## Pull requests

- Explain the user problem and the chosen solution.
- Add or update tests for behavior changes.
- Include screenshots for visible UI changes.
- Add a migration for every Prisma schema change; never ship `prisma db push`.
- Do not include customer data, credentials, analytics exports or outreach lists.
- Keep unrelated formatting and refactors out of the same pull request.

## Certificate of origin

Sign off each commit with `git commit -s`. The sign-off certifies the
[Developer Certificate of Origin](https://developercertificate.org/) and that
you have the right to contribute the work under the applicable project license.

## Licensing

Contributions are accepted under the license of the area being changed:
AGPL-3.0-only for the server and MIT for the independently licensed SDKs. See
`LICENSING.md`.
