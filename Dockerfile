FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/sdk-web/package.json packages/sdk-web/package.json
COPY packages/sdk-react-native/package.json packages/sdk-react-native/package.json
COPY packages/sdk-flutter/pubspec.yaml packages/sdk-flutter/pubspec.yaml
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @upstep/web exec prisma generate
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DIRECT_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build-only-secret \
    AUTH_URL=http://localhost:3000 \
    pnpm --filter @upstep/web build

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "scripts/start-production.sh"]
