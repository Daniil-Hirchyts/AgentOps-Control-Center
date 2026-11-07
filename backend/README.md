# AgentOps Control Center — Rust backend

Axum 0.8 + SQLx 0.8 (PostgreSQL 17) modular monolith implementing `contracts/CONTRACT.md`:
university instant-messaging API (REST + WebSocket) and the AI-agent human-in-the-loop approval workflow.

## Commands

```bash
# from repo root: start PostgreSQL
docker compose up -d postgres

cd backend
cargo run                          # API on BIND_ADDR (default 0.0.0.0:8080); runs migrations + startup recovery
cargo run --bin seed               # idempotent demo data (see below)
cargo run --bin export_openapi     # writes ../contracts/openapi/openapi.json (optional path arg)
cargo test                         # needs DATABASE_URL (read from ../.env); #[sqlx::test] creates throwaway DBs
cargo fmt --all && cargo clippy --all-targets -- -D warnings

# opt-in real LLM smoke test (an OpenAI-compatible server with a chat model loaded)
LLM_MODE=real cargo test --test llm_tests -- --ignored real_lmstudio_smoke
```

Swagger UI: <http://localhost:8080/api/docs> · OpenAPI JSON: `/api/openapi.json` (OpenAPI 3.1; WS event
DTOs are included as `ServerEvent` / `ClientEvent` components).

### Demo data (TEST ONLY)

`seed` creates synthetic users `alice`, `carol` (OPERATOR) and `bob`, `dave` (REVIEWER), all with password
`SEED_PASSWORD` (default `demo-password-123` — demo/test credential, never use in production), plus three
synthetic invoice cases owned by alice: 48 750 EUR vs avg 4 200 (high risk), 1 180 vs 1 050 (low), 6 400 vs 5 900 (medium).

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — (required) | `postgres://agentops:agentops@localhost:5432/agentops` |
| `BIND_ADDR` | `0.0.0.0:8080` | |
| `ALLOWED_ORIGINS` | empty | comma-separated; CORS (with credentials) + WS/refresh Origin check. Same-host origins are always allowed for WS/refresh |
| `JWT_SECRET` | — (required) | **≥ 32 bytes** or startup fails |
| `ACCESS_TOKEN_TTL_SECONDS` | 900 | |
| `REFRESH_TOKEN_TTL_SECONDS` | 604800 | |
| `WS_TICKET_TTL_SECONDS` | 30 | tickets are also single-use |
| `COOKIE_SECURE` | false | set `true` behind HTTPS |
| `LLM_MODE` | `mock` | `mock` \| `real` |
| `LLM_PROVIDER` | `lmstudio` | informational |
| `LLM_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible base |
| `LLM_MODEL` | empty | empty → first model from `GET {base}/models` |
| `LLM_API_KEY` | empty | sent as Bearer if set |
| `LLM_TIMEOUT_SECONDS` | 120 | per request |
| `RUST_LOG` | `agentops=info,tower_http=info` | |
| `SEED_PASSWORD` | `demo-password-123` | seed binary only |

## Module map (`src/`)

| Module | Responsibility |
|---|---|
| `main.rs` | thin: env, tracing, pool, migrations, recovery, serve |
| `lib.rs` / `api/` | `build_app(state) -> Router` (used by tests), CORS, 64 KiB body limit, trace spans (path only — never query strings/tickets), health, `/api/llm/models`, OpenAPI doc |
| `config.rs`, `state.rs` | env config (no `Debug`, secrets never logged), shared `AppState` |
| `error.rs`, `extract.rs` | `AppError` → `{"error":{code,message}}`; JSON/Path/Query extractors with contract-shaped rejections |
| `domain.rs` | typed TEXT enums: `Role`, `RunStatus`, `ApprovalStatus`, `CaseStatus`, `ActionName`, `RiskLevel`, `LlmMode`, `Decision` |
| `auth/` | Argon2id (blocking pool, dummy verify for unknown users), HS256 JWT (aud `api` / `ws`), `AuthUser` extractor + role guard, refresh tokens (SHA-256 at rest, rotation, reuse detection), CSRF (`X-Requested-With: agentops` + Origin) |
| `users/` | `POST /api/comptes`, `GET /api/utilisateurs` (live presence from hub) |
| `messaging/` | message persistence, `GET /api/messages/{id}` |
| `websocket/` | hub (`user_id → [(conn_id, mpsc::Sender)]`), presence broadcast, ticket + Origin validation, 16 KiB frames, ping 25 s / idle 60 s, 10 msgs / 5 s rate limit, event DTOs |
| `cases/` | invoice cases CRUD + validation |
| `agents/` | state machine (`can_transition`), central race-safe `transition()` (`UPDATE … WHERE status = $from`), worker (`tokio::spawn`), approved-action execution, startup recovery |
| `approvals/` | atomic decision (`UPDATE … WHERE status='PENDING' AND reviewer_id=$caller`; 0 rows → 404/403/409) |
| `actions/` | allowlisted Rust actions: `flag_invoice_for_review` (case → FLAGGED_FOR_REVIEW), `no_action`; exactly-once via `action_executions UNIQUE(approval_id)` in the same transaction |
| `audit/` | `audit_events` writer + `GET /api/audit-events` |
| `llm/` | `LlmProvider` trait, deterministic `MockProvider`, `OpenAiCompatProvider`, output extraction/validation; backend policy sets `requiresApproval` |
| `seed.rs` | demo data |

### Mock LLM

Deterministic: high + `flag_invoice_for_review` if amount > 3× `historicalAverage` or amount ≥ 10 000; medium + flag if
amount ≥ 5 000; else low + `no_action`. Test hooks in the invoice description: `[mock:invalid]` (invalid output),
`[mock:timeout]`, `[mock:slow]` (2 s delay, to observe `RUNNING`).

### Real LLM (OpenAI-compatible)

`POST {base}/chat/completions` with a strict system prompt and `response_format: json_schema (strict)`; if the
server answers 400 to that, the adapter retries (and keeps going) without it. The JSON object is extracted from the
content (code fences / `<think>` / prose stripped), deserialised with `deny_unknown_fields` and validated
(risk enum, summary 1–2000 chars, action allowlist). Errors: `ServerUnavailable`, `Timeout`, `ModelNotLoaded`,
`InvalidOutput`, `Http`. The worker makes up to 2 attempts for `InvalidOutput`/`Timeout`; any final failure → run
`FAILED` (never auto-approved).

### Why a plain HTTP client

The adapter is a small reqwest client rather than an LLM framework: it needs to retry without `response_format` on a
400, tell a missing model from a stopped server or a timeout, and list models. Another provider can be added behind
the `LlmProvider` trait without touching the workflow.

## Security notes

- Clients never supply sender ids/timestamps (WS `expediteurId`/`dateEnvoi` are ignored).
- Access token in memory on the client; refresh token only in an HttpOnly, SameSite=Strict cookie scoped to `/api/auth`.
- WS tickets: 30 s, audience `ws`, single use; upgrade 401 on bad ticket, 403 on disallowed Origin.
- Logs never contain passwords, tokens or tickets.

## Known limitations

- Presence/hub and WS-ticket replay cache are in-memory (single instance).
- Login has no brute-force throttling (beyond Argon2 cost).
