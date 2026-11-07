# Development guide

This guide covers local setup, LM Studio, tests, and the two-device demo used for the course presentation.

## 1. Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Rust | 1.92 (edition 2024) | `rustup` recommended |
| Node.js | 24 LTS or newer (26 on the dev machine) | |
| pnpm | 9 | `corepack enable` (Node ≤ 24) or `npm i -g pnpm@9` |
| Docker Desktop | recent | for PostgreSQL; full-stack images optional |
| LM Studio | recent | only for `LLM_MODE=real` |
| Optional | `jq`, `websocat`, `sqlx-cli` | API examples, WS testing, manual migrations |

## 2. Local setup (host processes, recommended)

```bash
# 1. Database
docker compose up -d postgres

# 2. Configuration
cp .env.example .env
# Replace JWT_SECRET with a real random value (>= 32 bytes):
openssl rand -base64 48
#   then paste it into .env as JWT_SECRET=...

# 3. Backend (runs migrations on startup, listens on 0.0.0.0:8080)
cd backend
cargo run
# in another terminal, once the backend has started at least once:
cargo run --bin seed

# 4. Frontend
cd apps/web
pnpm install
pnpm dev            # http://localhost:5173, proxies /api and /ws to :8080
```

The backend reads `.env` from the working directory or its parents (`dotenvy`), so the root `.env` is picked up when
running from `backend/`.

Seeded demo accounts (synthetic test data only):

| Username | Role | Password |
|---|---|---|
| alice | OPERATOR | `demo-password-123` |
| carol | OPERATOR | `demo-password-123` |
| bob | REVIEWER | `demo-password-123` |
| dave | REVIEWER | `demo-password-123` |

Useful URLs:

- App: <http://localhost:5173>
- Swagger UI: <http://localhost:8080/api/docs> (also <http://localhost:5173/api/docs>)
- Health: <http://localhost:8080/api/health>

Reset the database: `docker compose down -v && docker compose up -d postgres`, then restart the backend and re-seed.

## 3. Environment variables

| Variable | Default (`.env.example`) | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://agentops:agentops@localhost:5432/agentops` | PostgreSQL connection |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` | `agentops` | used by the compose `postgres` service |
| `BIND_ADDR` | `0.0.0.0:8080` | backend listen address |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | extra origins allowed for CORS and the WS upgrade (same-host origins are always allowed) |
| `RUST_LOG` | `agentops=info,tower_http=info` | tracing filter |
| `JWT_SECRET` | placeholder | HS256 key, at least 32 bytes. **Must** be changed |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | access JWT lifetime |
| `REFRESH_TOKEN_TTL_SECONDS` | `604800` | refresh cookie lifetime (7 days) |
| `WS_TICKET_TTL_SECONDS` | `30` | WebSocket ticket lifetime |
| `COOKIE_SECURE` | `false` | set `true` only when served over HTTPS |
| `LLM_PROVIDER` | `lmstudio` | informational, shown in `/api/health` |
| `LLM_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | empty | model id; empty = first model returned by `/v1/models` |
| `LLM_API_KEY` | empty | LM Studio ignores it; kept for compatibility |
| `LLM_TIMEOUT_SECONDS` | `120` | per-request timeout |
| `LLM_MODE` | `mock` | `mock` (deterministic, no LM Studio) or `real` |

Docker-only overrides (see section 7): `WEB_PORT`, `WEB_HTTPS_PORT`, `SITE_ADDRESS`, `DOCKER_LLM_BASE_URL`,
`DOCKER_ALLOWED_ORIGINS`.

## 4. LM Studio (real LLM mode)

The default `LLM_MODE=mock` needs nothing else and is what CI and the automated tests use. For the live demo with a
real local model:

1. Install LM Studio and download a **text instruct model**. Good choices are 7–8B instruct models in GGUF format,
   for example Qwen2.5-7B-Instruct, Llama-3.1-8B-Instruct or Mistral-7B-Instruct, at Q4_K_M or Q5_K_M quantization.
   The model must handle JSON / structured output well. An OCR or vision model is not suitable: the backend sends text
   and expects a JSON object back.
2. Load the model in LM Studio (or `lms load <model>`).
3. Start the local server:

   ```bash
   lms server start          # default http://localhost:1234
   curl -s http://localhost:1234/v1/models | jq '.data[].id'
   ```

4. In `.env`: `LLM_MODE=real`, and either set `LLM_MODEL` to one of the ids above or leave it empty to use the first one.
5. Restart the backend and check:

   ```bash
   curl -s http://localhost:8080/api/health | jq .llm
   curl -s http://localhost:8080/api/llm/models -H "Authorization: Bearer $TOKEN"   # as an OPERATOR
   ```

If LM Studio is stopped or the model produces invalid output twice, the run ends in `FAILED` with an `llm_error` or
`llm_response_invalid` audit event. It is never approved automatically.

Keep LM Studio bound to localhost. Do not enable "serve on local network" on an untrusted network, and never forward
port 1234 to the internet: the server has no authentication.

## 5. Tests

```bash
# Backend: needs the postgres container running and DATABASE_URL set
cd backend
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test

# Frontend
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# End-to-end (backend running with LLM_MODE=mock + seeded, frontend served on :5173)
cd tests/e2e
pnpm install
pnpm exec playwright install chromium     # once
pnpm exec playwright test                 # BASE_URL defaults to http://localhost:5173
pnpm report                               # open the HTML report
```

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs the same steps in three jobs: `backend` (with a PostgreSQL
service container), `frontend`, and `e2e` (depends on both, uploads the Playwright report as an artifact). It also
checks that `contracts/openapi/openapi.json` matches what `export_openapi` generates.

## 6. Two-device demo

The goal is to show two real devices exchanging messages through the server: a laptop and a phone on the same Wi-Fi.

### 6.1 Network setup

1. Connect the laptop and the phone to the same Wi-Fi network. Guest networks and eduroam often isolate clients from
   each other; a phone hotspot with the laptop connected to it is a reliable fallback.
2. Find the laptop's LAN address:

   ```bash
   ipconfig getifaddr en0        # macOS, e.g. 192.168.1.42
   ```

3. Start the backend as usual (`cargo run`, it already binds `0.0.0.0:8080`) and expose Vite on the LAN:

   ```bash
   cd apps/web
   pnpm dev --host               # prints Network: http://192.168.1.42:5173/
                                 # (vite.config.ts already sets host: true; the flag is harmless)
   ```

4. The first time, macOS asks whether to accept incoming connections for `node` (and possibly `agentops`). Click
   **Allow**. If you clicked Deny earlier: System Settings → Network → Firewall → Options.
5. On the phone, open `http://192.168.1.42:5173`.
6. Keep `COOKIE_SECURE=false`: the LAN demo is plain HTTP, and a `Secure` cookie would not be stored, so a page reload
   would log the user out.
7. If the WebSocket upgrade returns 403 (the UI shows "disconnected"), add the phone's origin to `.env` and restart
   the backend:

   ```
   ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.42:5173
   ```

   Same-host origins are accepted automatically, so this is only needed if the proxy rewrites the `Host` header.

Alternative: the Docker full stack (section 7) publishes port 8080 on all interfaces, so the phone can use
`http://192.168.1.42:8080` directly.

### 6.2 Demo script

Before starting: database seeded, `LLM_MODE=mock` (or `real` with LM Studio warmed up by one test request), laptop
logged in as **alice**, phone logged in as **bob**.

**Scenario A — instant messaging**

1. Show the user list on both devices: alice and bob are both marked online (green dot).
2. On the laptop, open the conversation with bob and type. The phone shows "alice is typing…".
3. Send "Bonjour Bob !". It appears on the phone immediately, with the server timestamp.
4. Reply from the phone. It appears on the laptop.
5. Open Swagger (`/api/docs`) and call `GET /api/messages/{bobId}` to show the same history over REST.

**Scenario B — approval (suspicious invoice)**

1. Laptop (alice): create a case for a suspicious invoice: amount far above the historical average and a change of
   bank details in the description (for example the Northwind invoice from `docs/api.md`: 48 750 EUR vs. a 4 200 EUR
   average).
2. Start an agent run and choose **bob** as reviewer. The run goes PENDING → RUNNING → AWAITING_APPROVAL; show the status
   badge changing live.
3. Phone (bob): a notification "Approval requested" appears. Open it: invoice, risk level `high`, the model's reasoning,
   and the proposed action `flag_invoice_for_review`.
4. Bob approves with a short reason.
5. Laptop: the run moves to APPROVED → RUNNING → COMPLETED and the case becomes `FLAGGED_FOR_REVIEW`.
6. Open the audit timeline of the run: `run_created`, `llm_request`, `llm_response_valid`, `approval_requested`,
   `approval_decided`, `action_executed`.

**Scenario C — rejection**

1. Repeat B with a second suspicious invoice.
2. Bob rejects it ("Vendor confirmed, invoice is legitimate").
3. The run ends REJECTED → CANCELLED, the case stays `OPEN`, and the audit log has no `action_executed` event.
4. Optional: try to approve the same approval again from Swagger as bob → `409 conflict`.

**Reconnection / offline recipient**

1. On the phone, turn on airplane mode (or close the tab). On the laptop, bob goes offline within a few seconds
   (immediately when the tab is closed, after the 60 s idle timeout for a dropped network).
2. Send two messages from alice to bob while he is offline.
3. Turn airplane mode off / reopen the app. The client reconnects with a new ticket, refetches the conversation over
   REST, and both messages are there. bob is shown online again on the laptop.
4. Optional: restart the backend during a pending approval. After restart the run is still AWAITING_APPROVAL and bob can
   still decide it.

### 6.3 Screenshot checklist for the report

Automated captures (synthetic data, desktop 1440×900 + phone 390×844) are regenerated with:

```bash
cd backend && cargo run --bin seed      # once, on a clean database
cd tests/e2e && pnpm exec playwright test --config screenshots.config.ts
```

This writes `desktop-messaging.png`, `mobile-messaging.png`, `desktop-run-awaiting-approval.png`,
`mobile-approval-inbox.png`, `mobile-approval-detail.png`, `desktop-dashboard.png`, `desktop-new-case.png`,
`desktop-concept.png`, `desktop-architecture.png` and `swagger-ui.png` into
`docs/screenshots/`.

The report figures `demo-two-devices.png`, `mockup-run-awaiting-approval.png` and `mockup-approval-detail.png` are
the same screens captured at MacBook Pro 14" (1512×982 @2x) and iPhone 18 Pro (402×874 @3x) resolutions and placed in
Apple's product bezels (Apple Design Resources, not stored in the repository).

The report itself is LaTeX, in `docs/report/`:

```bash
cd docs/report && pdflatex rapport.tex && pdflatex rapport.tex   # second run fills in the table of contents
```

Optional, by hand during the physical demo:

- [ ] phone: messages recovered after airplane mode / reconnection
- [ ] green GitHub Actions run (optional)

## 7. Docker full stack

```bash
cp .env.example .env            # set JWT_SECRET
docker compose up --build       # add -d to detach
open http://localhost:8080
```

- `docker compose up` starts the whole application: `postgres`, `backend` (migrations at startup), `seed` (one-shot,
  idempotent synthetic data; `SEED_DEMO_DATA=false` skips it) and `web`.
- For host development, start only the database with `docker compose up -d postgres`.
- `backend` is built from `infra/docker/backend.Dockerfile`, reads `.env`, and gets `DATABASE_URL` pointing at the
  `postgres` service. It is not published on the host.
- `web` is Caddy (`infra/docker/web.Dockerfile` + `infra/caddy/Caddyfile`): serves the SPA and proxies `/api/*` and
  `/ws/*` to the backend, so the browser sees a single origin. Port `WEB_PORT` (default 8080) → container 80. Phones
  on the same Wi-Fi use `http://<laptop-IP>:8080`; Caddy keeps the `Host` header so the WebSocket Origin check passes.
- Setting `SITE_ADDRESS=agentops.example.org` makes Caddy obtain a certificate automatically. That requires a public
  DNS name, ports 80/443 published (`WEB_PORT=80 WEB_HTTPS_PORT=443`), and `COOKIE_SECURE=true`.
- Ports can be moved when they clash with a host setup: `POSTGRES_PORT`, `WEB_PORT`, `WEB_HTTPS_PORT`.

### Tests in containers (profile `test`)

```bash
docker compose --profile test run --rm backend-test   # cargo test, uses the compose PostgreSQL
docker compose --profile test run --rm e2e            # Playwright (Chromium) against http://web
```

The E2E report is written to `tests/e2e/playwright-report/`.

### LM Studio from inside Docker

The backend container reaches the host through `host.docker.internal` (the compose file sets
`LLM_BASE_URL=http://host.docker.internal:1234/v1`; override with `DOCKER_LLM_BASE_URL`).

- On Docker Desktop for Mac, `host.docker.internal` is routed to the Mac. Whether LM Studio answers depends on the
  interface it listens on. With the default localhost binding it often works, because Docker Desktop forwards the
  connection from the host side, but this depends on the Docker Desktop version and networking mode.
- If the backend logs `llm_error` / connection refused, the remaining option is LM Studio's "serve on local network"
  setting, which binds `0.0.0.0:1234`. That makes the unauthenticated LLM server reachable by every device on the Wi-Fi.
  Only do it on a trusted network, and turn it off afterwards.
- On Linux, `extra_hosts: host-gateway` maps the name to the bridge gateway; LM Studio must then listen on that
  interface.

**Recommendation:** for demos with a real model, run the backend on the host (`cargo run`) and only PostgreSQL in Docker.
LM Studio then stays on `127.0.0.1` and is never exposed. Use the Docker full stack with `LLM_MODE=mock`.

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend exits at startup with a database error | `docker compose up -d postgres`, check `DATABASE_URL`, wait for the health check |
| `JWT_SECRET` error at startup | value missing or shorter than 32 bytes |
| Logged out on every page reload | `COOKIE_SECURE=true` while using plain HTTP; set it to `false` |
| WebSocket stays disconnected, upgrade 403 | origin not allowed; add it to `ALLOWED_ORIGINS` |
| WebSocket 401 | ticket expired (30 s) or reused after a long pause; the client should fetch a new one per connection |
| Phone cannot open the page | different Wi-Fi / client isolation, macOS firewall blocked `node`, Vite started without `--host` |
| Runs always `FAILED` with real LLM | LM Studio server not started, no model loaded, wrong `LLM_MODEL`, or the model is too weak for JSON output |
| Port 5432 already in use | another local PostgreSQL; stop it or change the published port |
| Port 8080 in use by Docker `web` | a host backend is running; stop it or set `WEB_PORT` |
