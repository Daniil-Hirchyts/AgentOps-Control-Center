# AgentOps Control Center

Instant messaging between two devices (university project, course *API and Web Services*), extended into a
Human-in-the-Loop approval platform for an AI agent running on a local LLM.

- **Messaging:** accounts, JWT login, user list with live presence, real-time messages over WebSocket, history over
  REST, offline recipients, typing indicator. Demonstrated between a laptop and a phone.
- **AgentOps:** an operator submits an invoice; an agent (LM Studio or a deterministic mock) assesses the risk and
  proposes an action; a reviewer approves or rejects it in real time from another device; the approved action is
  executed exactly once and every step is audited.

Stack: Rust (Axum, Tokio, SQLx, Utoipa, Argon2id, jsonwebtoken) · PostgreSQL 17 · React + Vite + TypeScript
(TanStack Router/Query, Zustand, Tailwind, shadcn/ui) · LM Studio · Docker Compose · Caddy · GitHub Actions.

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
| WebSocket security | short-lived WS ticket (aud `ws`), Origin check, frame size and rate limits |
| Persistence | PostgreSQL, SQLx, embedded migrations |
| Two-device demo | [`docs/development.md` §6](docs/development.md#6-two-device-demo) |
| Bonus: OpenAPI / Swagger | Utoipa, `/api/openapi.json`, `/api/docs` |
| Bonus: typing indicator, WS rate limiting | `typing` events, 10 msgs / 5 s per connection |
| Extension: AI agent + HITL | `/api/cases`, `/api/agent-runs`, `/api/approvals`, state machine, exactly-once execution |
| Audit trail | `/api/audit-events`, `audit_events` table |
| Tests | backend integration tests, frontend tests, Playwright two-context E2E, CI |
| Documentation / report | [`docs/`](docs/), French report [`docs/report.md`](docs/report.md) |

## Prerequisites

- Rust 1.92+ (edition 2024)
- Node.js 24+ and pnpm 9
- Docker Desktop (for PostgreSQL)
- Optional: LM Studio (real LLM mode), `jq`, `websocat`

## Quick start

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

Synthetic test data created by `cargo run --bin seed`. Password for all: `demo-password-123`.

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
│   ├── docker/              backend.Dockerfile, web.Dockerfile
│   └── caddy/Caddyfile      SPA + reverse proxy for /api and /ws
├── docs/                    architecture, API, development guide, French report
├── .github/workflows/ci.yml backend, frontend and e2e jobs
└── docker-compose.yml       postgres (default) + backend/web (profile "app")
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
| `LLM_BASE_URL` | `http://localhost:1234/v1` | LM Studio endpoint |
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
Step-by-step script (messaging, approval, rejection, reconnection) and screenshot checklist:
[`docs/development.md` §6](docs/development.md#6-two-device-demo).

## LM Studio (real LLM)

1. Load a text instruct model that handles JSON output (e.g. Qwen2.5-7B-Instruct, Llama-3.1-8B-Instruct,
   Mistral-7B-Instruct, GGUF Q4_K_M). Vision/OCR models are not suitable.
2. `lms server start` (serves `http://localhost:1234/v1`).
3. In `.env`: `LLM_MODE=real`, optionally `LLM_MODEL=<id>`; restart the backend.
4. Check `GET /api/health` and `GET /api/llm/models`.

LLM failures (server down, timeout, invalid output after 2 attempts) put the run in `FAILED`; nothing is ever
approved or executed automatically. Keep LM Studio on localhost and never expose port 1234 publicly.

## Docker full stack

```bash
cp .env.example .env               # set JWT_SECRET
docker compose --profile app up --build -d
docker compose exec backend seed
open http://localhost:8080         # SPA + /api + /ws through Caddy; Swagger at /api/docs
```

`docker compose up` without the profile still starts only PostgreSQL. The `web` service (Caddy) is published on
`WEB_PORT` (default 8080); the backend is only reachable through it. Set `SITE_ADDRESS` to a public domain for
automatic HTTPS (then also `COOKIE_SECURE=true`).

The containerised backend reaches LM Studio via `host.docker.internal`, which depends on how LM Studio is bound. For
real-LLM demos, run the backend on the host instead; see
[`docs/development.md` §7](docs/development.md#lm-studio-from-inside-docker).

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend cannot connect to the database | `docker compose up -d postgres`; check `DATABASE_URL` |
| Logged out after every reload | `COOKIE_SECURE=true` on plain HTTP; set `false` |
| WebSocket disconnected, upgrade 403 | add the page origin to `ALLOWED_ORIGINS` |
| Phone cannot reach the laptop | same Wi-Fi without client isolation, `pnpm dev --host`, allow `node` in the macOS firewall |
| Agent runs always `FAILED` | LM Studio server not started / no model loaded / wrong `LLM_MODEL`; try `LLM_MODE=mock` |
| Port 8080 busy with `--profile app` | a host backend is running; stop it or set `WEB_PORT` |

More in [`docs/development.md`](docs/development.md#8-troubleshooting).

## Documentation

- [`docs/architecture.md`](docs/architecture.md): components, REST vs WS, data model, state machine, HITL sequence,
  security model
- [`docs/api.md`](docs/api.md): endpoint reference with examples
- [`docs/development.md`](docs/development.md): setup, LM Studio, tests, two-device demo
- [`docs/report.md`](docs/report.md): written report (French)
- [`contracts/CONTRACT.md`](contracts/CONTRACT.md): API contract (source of truth)

## License

Academic project, written for coursework. Not licensed for production use. All demo accounts and data are synthetic.
