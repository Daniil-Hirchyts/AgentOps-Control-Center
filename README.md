# AgentOps Control Center

A platform for supervising and validating AI agents (university project, course *API and Web Services*).
An AI agent carries out tasks, asks for validation when an action is sensitive, and an operator and a reviewer discuss it in
real time to authorize or reject the action.

Concepts: agentic AI, human-in-the-loop, tool calling, observability, WebSocket.

- **Agents and approvals:** an operator submits an invoice; an agent (any OpenAI-compatible model, or a deterministic
  mock) assesses the risk and proposes an action through a tool call; a reviewer approves or rejects it in real time
  from another device; the approved action is executed exactly once and every step is audited.
- **Real-time collaboration:** accounts, JWT login, user list with live presence, messages over WebSocket with
  history over REST, offline recipients and a typing indicator, so the operator and the reviewer can talk the
  decision over. Demonstrated between a laptop and a phone.
- **Learn pages in the app:** `/learn/concept` explains what is simulated and what each demo case is for;
  `/learn/architecture` walks through the servers, REST vs WebSocket and the approval loop with diagrams.

Stack: Rust (Axum, Tokio, SQLx) · PostgreSQL 17 · React + Vite + TypeScript · Docker Compose · Caddy.

![Architecture](docs/architecture.svg)

## Rubric mapping

| Criterion | Where it is implemented |
|---|---|
| Account creation | `POST /api/comptes`, Argon2id hashing, DB constraints (`backend/migrations/`) |
| JWT authentication | `POST /api/auth/login`, Bearer access token, HttpOnly refresh cookie, `401` handling |
| User list | `GET /api/utilisateurs` (JSON array, live `online` flag) |
| Real-time messaging over WebSocket | `/ws/messages?ticket=…`, message events to recipient + echo to sender |
| Message history over REST | `GET /api/messages/{utilisateurId}` with `limit` / `beforeId` |
| Offline recipients | messages persisted before delivery, refetched over REST on reconnect |
| Presence | in-memory connection registry, `user_presence` events |
| WebSocket security | short-lived WS ticket, Origin check, frame size and rate limits |
| Persistence | PostgreSQL, SQLx, embedded migrations |
| Two-device demo | [`docs/development.md` §6](docs/development.md#6-two-device-demo) |
| Bonus: OpenAPI / Swagger | Utoipa, `/api/openapi.json`, `/api/docs` |
| Bonus: typing indicator, WS rate limiting | `typing` events, 10 msgs / 5 s per connection |
| Extension: AI agent + HITL | `/api/cases`, `/api/agent-runs`, `/api/approvals`, state machine, exactly-once execution |
| Audit trail | `/api/audit-events`, `audit_events` table |
| Tests | backend integration tests, frontend tests, Playwright two-context E2E, CI |
| Documentation / report | [`docs/`](docs/), French report [`docs/report/rapport.pdf`](docs/report/rapport.pdf) |

## Prerequisites

- Rust 1.92+ (edition 2024)
- Node.js 24+ and pnpm 9
- Docker Desktop (the Docker quick start needs nothing else)
- Optional: an OpenAI-compatible LLM (real mode), `jq`, `websocat`

## Quick start (Docker, everything)

```bash
cp .env.example .env               # then set JWT_SECRET (openssl rand -base64 48)
docker compose up --build          # postgres + backend + demo seed + web
```

Open <http://localhost:8080> (Swagger at <http://localhost:8080/api/docs>). From a phone on the same Wi-Fi, open
`http://<laptop-LAN-IP>:8080`. Tests run in containers too:

```bash
docker compose --profile test run --rm backend-test   # Rust unit + integration tests
docker compose --profile test run --rm e2e            # Playwright, against the running stack
```

## Quick start (host development, hot reload)

```bash
docker compose up -d postgres
cp .env.example .env
openssl rand -base64 48            # paste the output as JWT_SECRET in .env
cd backend && cargo run            # terminal 1: API on :8080, runs migrations
cd backend && cargo run --bin seed # terminal 2: demo users
cd apps/web && pnpm install && pnpm dev   # terminal 3: http://localhost:5173
```

Open <http://localhost:5173> and log in with one of the demo accounts.

### Demo accounts

Synthetic test data created by `cargo run --bin seed` (or automatically by the `seed` container). Password for all: `demo-password-123`.

| Username | Role |
|---|---|
| alice, carol | OPERATOR |
| bob, dave | REVIEWER |

### API documentation

- Swagger UI: <http://localhost:8080/api/docs> or through the Vite proxy <http://localhost:5173/api/docs>
- OpenAPI JSON: <http://localhost:8080/api/openapi.json> (committed copy in `contracts/openapi/`)
- Reference with curl / websocat examples: [`docs/api.md`](docs/api.md)

## Project structure

```
.
├── backend/                 Rust API (binary `agentops`, plus `seed` and `export_openapi`)
│   ├── migrations/          SQL migrations (embedded at compile time)
│   └── src/
├── apps/web/                React + Vite SPA
├── contracts/               CONTRACT.md (API/WS/state machine source of truth), OpenAPI
├── tests/e2e/               Playwright end-to-end tests (two browser contexts)
├── infra/
│   ├── docker/              backend, web and e2e Dockerfiles
│   └── caddy/Caddyfile      SPA + reverse proxy for /api and /ws
├── docs/                    architecture, API, development guide, French report
├── .github/workflows/ci.yml backend, frontend and e2e jobs
└── docker-compose.yml       postgres, backend, seed, web (+ backend-test, e2e in profile "test")
```

## Environment variables

All variables live in `.env` (copy from `.env.example`). Full descriptions in
[`docs/development.md`](docs/development.md#3-environment-variables).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://agentops:agentops@localhost:5432/agentops` | PostgreSQL connection |
| `BIND_ADDR` | `0.0.0.0:8080` | backend listen address |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | extra allowed origins (same-host always allowed) |
| `JWT_SECRET` | placeholder | HS256 key, ≥ 32 bytes, **change it** |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | access token lifetime |
| `REFRESH_TOKEN_TTL_SECONDS` | `604800` | refresh cookie lifetime |
| `WS_TICKET_TTL_SECONDS` | `30` | WebSocket ticket lifetime |
| `COOKIE_SECURE` | `false` | `true` only behind HTTPS |
| `LLM_MODE` | `mock` | `mock` or `real` |
| `LLM_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible endpoint (LM Studio by default) |
| `LLM_API_KEY` | empty | API key, for hosted providers |
| `LLM_MODEL` | empty | model id, empty = first available |
| `LLM_TIMEOUT_SECONDS` | `120` | LLM request timeout |
| `RUST_LOG` | `agentops=info,tower_http=info` | log filter |

## Testing

```bash
cd backend && cargo fmt --all -- --check && cargo clippy --all-targets -- -D warnings && cargo test
cd apps/web && pnpm typecheck && pnpm lint && pnpm test && pnpm build
# E2E: backend running (LLM_MODE=mock) and seeded, frontend on :5173
cd tests/e2e && pnpm install && pnpm exec playwright install chromium && pnpm exec playwright test
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and pull request, with a PostgreSQL service
container, and uploads the Playwright report as an artifact.

## Two-device demo

Laptop and phone on the same Wi-Fi, `pnpm dev --host`, open `http://<laptop-LAN-IP>:5173` on the phone.
Step-by-step script (messaging, approval, rejection, reconnection):
[`docs/development.md` §6](docs/development.md#6-two-device-demo).

## Real LLM

Any OpenAI-compatible API works: a local server such as LM Studio, or a hosted provider.

1. Use an instruct model that handles JSON output.
2. In `.env`: `LLM_MODE=real`, `LLM_BASE_URL`, and `LLM_API_KEY` / `LLM_MODEL` if the provider needs them; restart
   the backend.
3. Check `GET /api/health` and `GET /api/llm/models`.

LLM failures (server down, timeout, invalid output after 2 attempts) put the run in `FAILED`; nothing is ever
approved or executed automatically. A local server should stay on localhost.

## Docker details

| Service | Image | Role |
|---|---|---|
| `postgres` | postgres:17-alpine | database, published on `127.0.0.1:${POSTGRES_PORT:-5432}` |
| `backend` | `infra/docker/backend.Dockerfile` | Rust API + WebSocket, migrations at startup, internal only |
| `seed` | same image | one-shot, idempotent demo data (`SEED_DEMO_DATA=false` to skip) |
| `web` | `infra/docker/web.Dockerfile` | Caddy: React build + reverse proxy for `/api` and `/ws`, port `WEB_PORT` (8080) |
| `backend-test` (profile `test`) | rust:1-bookworm | `cargo test` against the compose PostgreSQL |
| `e2e` (profile `test`) | `infra/docker/e2e.Dockerfile` | Playwright runner targeting `http://web` |

Set `SITE_ADDRESS` to a public domain for automatic HTTPS (then also `COOKIE_SECURE=true`). The containerised backend
reaches a local LLM server via `host.docker.internal`; running the backend on the host is simpler, see [`docs/development.md` §7](docs/development.md#local-llm-from-inside-docker).

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend cannot connect to the database | `docker compose up -d postgres`; check `DATABASE_URL` |
| Logged out after every reload | `COOKIE_SECURE=true` on plain HTTP; set `false` |
| WebSocket disconnected, upgrade 403 | add the page origin to `ALLOWED_ORIGINS` |
| Phone cannot reach the laptop | same Wi-Fi without client isolation, `pnpm dev --host`, allow `node` in the macOS firewall |
| Agent runs always `FAILED` | LLM server unreachable / no model loaded / wrong `LLM_MODEL`; try `LLM_MODE=mock` |
| Port 8080 busy | a host backend is running; stop it or set `WEB_PORT=8088` |

More in [`docs/development.md`](docs/development.md#8-troubleshooting).

## Documentation

- [`docs/architecture.md`](docs/architecture.md): components, REST vs WS, data model, state machine, HITL sequence,
  security model
- [`docs/api.md`](docs/api.md): endpoint reference with examples
- [`docs/development.md`](docs/development.md): setup, LLM, tests, two-device demo
- [`docs/report/rapport.pdf`](docs/report/rapport.pdf): written report (French, LaTeX source in `docs/report/rapport.tex`)
- [`contracts/CONTRACT.md`](contracts/CONTRACT.md): API contract (source of truth)

## License

Academic project, written for coursework. Not licensed for production use. All demo accounts and data are synthetic.
