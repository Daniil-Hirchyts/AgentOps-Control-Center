# syntax=docker/dockerfile:1.7
# Playwright E2E runner. The image tag must match @playwright/test in tests/e2e/package.json.
# Build from the repository root (used by `docker compose --profile test run --rm e2e`).
FROM mcr.microsoft.com/playwright:v1.65.0-noble
ARG PNPM_VERSION=9.15.0
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /e2e
COPY tests/e2e/package.json tests/e2e/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tests/e2e/ ./
CMD ["pnpm", "exec", "playwright", "test"]
