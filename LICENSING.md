# Licensing

Upstep uses a split license so the application remains open source while the
client SDKs stay easy to embed anywhere.

| Code | License |
| --- | --- |
| `apps/web`, Prisma schema, migrations and repository tooling | AGPL-3.0-only |
| `packages/sdk-web` | MIT |
| `packages/sdk-react-native` | MIT |
| `packages/sdk-flutter` | MIT |
| `packages/types` | MIT |
| Upstep name, logos and visual brand assets | Not licensed as software; see `TRADEMARKS.md` |

Unless a file is inside a package with its own license, contributions are
accepted under AGPL-3.0-only. This project does not require copyright assignment.

Dependency licenses are not changed by Upstep's license. Release builders
should retain the notices shipped by dependencies. In particular, production
installations may include libvips under LGPL-3.0-or-later through Sharp and
browser compatibility data under CC-BY-4.0 through caniuse-lite.
