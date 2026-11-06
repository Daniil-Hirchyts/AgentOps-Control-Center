# syntax=docker/dockerfile:1.7
# AgentOps backend image (Rust / Axum).
# Build from the repository root:
#   docker build -f infra/docker/backend.Dockerfile -t agentops-backend .

############################
# 1. Builder
############################
FROM rust:1-bookworm AS builder
WORKDIR /src/backend

# sqlx::query! macros must not try to reach a database during `docker build`.
# If the crate uses compile-time checked queries, commit the `.sqlx/` directory
# produced by `cargo sqlx prepare` (it is copied with the sources below).
ENV SQLX_OFFLINE=true \
    CARGO_TERM_COLOR=always

# --- Dependency layer -------------------------------------------------------
# Copy only the manifests and compile a stub crate, so the (slow) dependency
# build is cached in its own layer until Cargo.toml / Cargo.lock change.
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    mkdir -p src \
 && echo 'fn main() {}' > src/main.rs \
 && for f in $(grep -oE 'path *= *"[^"]+\.rs"' Cargo.toml | sed -E 's/.*"(.+)"/\1/'); do \
      mkdir -p "$(dirname "$f")" && echo 'fn main() {}' > "$f"; \
    done \
 && cargo build --release --locked \
 && rm -rf src target/release/agentops target/release/deps/*agentops* \
           target/release/.fingerprint/agentops-*

# --- Application layer ------------------------------------------------------
# Migrations are embedded in the binary at compile time by sqlx::migrate!().
COPY backend/ ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo build --release --locked --bins \
 && mkdir -p /out \
 && cp target/release/agentops /out/ \
 && for b in seed export_openapi; do \
      if [ -f "target/release/$b" ]; then cp "target/release/$b" /out/; fi; \
    done

############################
# 2. Runtime
############################
FROM debian:bookworm-slim AS runtime

# ca-certificates: TLS to external hosts; curl: container healthcheck only.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 10001 agentops \
 && useradd --system --uid 10001 --gid agentops --home-dir /app --shell /usr/sbin/nologin agentops

WORKDIR /app
COPY --from=builder /out/ /usr/local/bin/
# Not needed at runtime (migrations are embedded), kept for inspection/debugging.
COPY backend/migrations ./migrations

USER agentops:agentops
ENV BIND_ADDR=0.0.0.0:8080 \
    RUST_LOG=agentops=info,tower_http=info
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/agentops"]
