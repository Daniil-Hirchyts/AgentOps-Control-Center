# syntax=docker/dockerfile:1.7
# AgentOps web image: React/Vite SPA built with pnpm, served by Caddy, which
# also reverse-proxies /api and /ws to the backend (same origin in production).
# Build from the repository root:
#   docker build -f infra/docker/web.Dockerfile -t agentops-web .

############################
# 1. Build the SPA
############################
# Node 24 LTS still bundles corepack (removed from Node 25+).
FROM node:24-bookworm-slim AS build
# Pinned to match the lockfile (lockfileVersion 9.0) and the dev machine.
ARG PNPM_VERSION=9.15.0
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /src/apps/web

# Install dependencies first (cached until the lockfile changes).
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile

# Shared contracts (generated API types) may be imported from ../../contracts.
COPY contracts/ /src/contracts/
COPY apps/web/ ./
RUN pnpm build

############################
# 2. Serve with Caddy
############################
FROM caddy:2-alpine AS runtime
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/apps/web/dist /srv
EXPOSE 80 443
# The official image runs `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`.
