#!/usr/bin/env bash
#
# Publishes the Upstep packages to npm in dependency order:
#   @upstep/types  →  @upstep/js  →  @upstep/react-native
#
# - Builds the packages that need a build step first.
# - Skips any package whose current version is already on npm (safe to re-run).
# - Forwards a 2FA one-time password if you have 2FA enabled.
#
# Usage:
#   pnpm publish:packages                 # will prompt for OTP if your account needs it
#   pnpm publish:packages 123456          # pass the OTP as an argument
#   NPM_OTP=123456 pnpm publish:packages  # or via env var
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OTP="${1:-${NPM_OTP:-}}"
OTP_FLAG=()
if [ -n "$OTP" ]; then
  OTP_FLAG=(--otp "$OTP")
fi

# Package directories in dependency order.
DIRS=("packages/types" "packages/sdk-web" "packages/sdk-react-native")

pkg_field() { node -p "require('./$1/package.json').$2"; }

echo "→ Verifying npm login…"
if ! npm whoami >/dev/null 2>&1; then
  echo "✖ Not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi
echo "  logged in as $(npm whoami)"

echo "→ Building packages…"
pnpm --filter "@upstep/types" build
pnpm --filter "@upstep/js" build

published=0
skipped=0

for dir in "${DIRS[@]}"; do
  name="$(pkg_field "$dir" name)"
  version="$(pkg_field "$dir" version)"

  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "• ${name}@${version} already published — skipping"
    skipped=$((skipped + 1))
    continue
  fi

  echo "↑ Publishing ${name}@${version}…"
  # Note the empty-array-safe expansion (works on macOS bash 3.2 under `set -u`).
  pnpm --filter "$name" publish --access public --no-git-checks ${OTP_FLAG[@]+"${OTP_FLAG[@]}"}
  published=$((published + 1))
done

echo ""
echo "✔ Done. Published: ${published}, skipped: ${skipped}."
