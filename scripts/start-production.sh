#!/bin/sh

set -eu

: "${DATABASE_URL:?DATABASE_URL must be configured}"

# Managed PostgreSQL services commonly expose only DATABASE_URL. Prisma's
# directUrl is still required by the schema, so use the same connection when a
# separate non-pooled URL has not been configured.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

pnpm --filter @upstep/web exec prisma migrate deploy

exec pnpm --filter @upstep/web start --hostname 0.0.0.0 --port "${PORT:-3000}"
