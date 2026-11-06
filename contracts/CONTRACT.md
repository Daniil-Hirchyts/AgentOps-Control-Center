# AgentOps Control Center — Shared Contract (source of truth)

All backend and frontend work MUST follow this file. Changes require updating this file first.

## Conventions

- JSON everywhere, **camelCase** field names. IDs are `i64` (PostgreSQL `BIGINT GENERATED ALWAYS AS IDENTITY`).
- Timestamps are server-generated, serialized RFC 3339 UTC (`2026-09-21T10:15:30Z`).
- Errors: HTTP status + body `{"error": {"code": "<snake_case>", "message": "<human text>"}}`.
  Codes: `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409),
  `validation_error` (422), `bad_request` (400), `rate_limited` (429), `internal` (500), `llm_unavailable` (503).
- Auth header: `Authorization: Bearer <accessToken>`. Missing/invalid/expired → 401.
- Mandatory university list endpoints return **JSON arrays**. AgentOps list endpoints return
  `Page<T> = {"items": T[], "total": number, "limit": number, "offset": number}` with query `?limit=&offset=` (default 50, max 200).
- Roles (enum strings): `OPERATOR`, `REVIEWER`.
- Backend port 8080. Vite dev server 5173 proxies `/api` and `/ws` to 8080 (same-origin in dev and prod).

## DTOs

```ts
UserDto        { id, username, role: Role, online: boolean, createdAt }
AccountCreated { id, username, role, createdAt }
LoginResponse  { accessToken, tokenType: "Bearer", expiresIn /*s*/, user: UserDto }
WsTicket       { ticket, expiresIn /*s, 30*/ }
MessageDto     { id, expediteurId, destinataireId, contenu, dateEnvoi }   // French names per assignment

InvoiceInput   { invoiceNumber, vendor, amount /*number*/, currency /*3 letters*/, issueDate /*YYYY-MM-DD*/,
                 description, historicalAverage?: number }
CaseDto        { id, title, invoice: InvoiceInput, status: CaseStatus, createdBy, createdAt, updatedAt }
CaseStatus     = "OPEN" | "FLAGGED_FOR_REVIEW" | "CLOSED"

RunStatus      = "PENDING"|"RUNNING"|"AWAITING_APPROVAL"|"APPROVED"|"REJECTED"|"COMPLETED"|"CANCELLED"|"FAILED"
AgentAnalysis  { riskLevel: "low"|"medium"|"high", reasoningSummary, recommendedAction: ActionName, requiresApproval: boolean }
ActionName     = "flag_invoice_for_review" | "no_action"      // Rust-side allowlist
AgentRunDto    { id, caseId, caseTitle, status: RunStatus, modelIdentifier, llmMode: "real"|"mock",
                 inputSnapshot: InvoiceInput, output: AgentAnalysis|null, error: string|null,
                 attempts, reviewerId, createdBy, createdAt, updatedAt,
                 approval: ApprovalDto|null }

ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED"
ApprovalDto    { id, agentRunId, caseId, caseTitle, reviewerId, reviewerUsername, requestedBy, requestedByUsername,
                 proposedAction: ActionName, riskLevel, reasoningSummary, invoice: InvoiceInput,
                 status: ApprovalStatus, decisionReason: string|null, decidedBy: number|null,
                 createdAt, decidedAt: string|null }
DecisionRequest { decision: "approve" | "reject", reason?: string /*<=1000*/ }

AuditEventDto  { id, agentRunId: number|null, actorId: number|null, actorUsername: string|null,
                 eventType: string, payload: object, createdAt }
HealthDto      { status: "ok"|"degraded", database: "ok"|"error", llm: { mode, provider, model, reachable: boolean|null } }
```

Audit event types: `run_created`, `run_status_changed`, `llm_request`, `llm_response_valid`, `llm_response_invalid`,
`llm_error`, `approval_requested`, `approval_decided`, `action_executed`, `action_skipped`, `run_recovered`.

## REST endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/comptes` | public | body `{username, password, role?}` (role default OPERATOR). username 3–32 `[A-Za-z0-9_.-]`, password 8–128. 201 `AccountCreated`; 409 if taken |
| POST | `/api/auth/login` | public | `{username, password}` → 200 `LoginResponse`; sets refresh cookie; 401 on bad creds |
| POST | `/api/auth/refresh` | refresh cookie + header `X-Requested-With: agentops` | → `LoginResponse` (rotates cookie) |
| POST | `/api/auth/logout` | refresh cookie + `X-Requested-With` | 204, revokes refresh token |
| GET | `/api/auth/me` | JWT | `UserDto` |
| POST | `/api/auth/ws-ticket` | JWT | `WsTicket` (JWT, aud `ws`, 30 s) |
| GET | `/api/utilisateurs` | JWT | `UserDto[]` (all users incl. caller) with live online status |
| GET | `/api/messages/{utilisateurId}` | JWT | `MessageDto[]` conversation caller↔user, ascending; `?limit` (default 200, max 500) `?beforeId`; 404 unknown user |
| POST | `/api/cases` | OPERATOR | `{title, invoice: InvoiceInput}` → 201 `CaseDto` |
| GET | `/api/cases` | OPERATOR | `Page<CaseDto>` (own cases) |
| GET | `/api/cases/{id}` | owner OPERATOR, or REVIEWER assigned to a run of it | `CaseDto` |
| POST | `/api/agent-runs` | OPERATOR, owns case | `{caseId, reviewerId}` reviewerId must be a REVIEWER ≠ caller → 202 `AgentRunDto` (PENDING); processing is async |
| GET | `/api/agent-runs` | JWT | `Page<AgentRunDto>`; operator: runs they created; reviewer: runs assigned to them. `?status=&caseId=` |
| GET | `/api/agent-runs/{id}` | creator or assigned reviewer | `AgentRunDto` |
| GET | `/api/approvals` | JWT | `Page<ApprovalDto>`; reviewer: assigned; operator: requested by them. `?status=PENDING` default all |
| GET | `/api/approvals/{id}` | assigned reviewer or requester | `ApprovalDto` |
| POST | `/api/approvals/{id}/decision` | assigned REVIEWER only | `DecisionRequest` → 200 `ApprovalDto`; 409 if already decided |
| GET | `/api/audit-events` | JWT | `Page<AuditEventDto>` limited to runs the caller may see; `?agentRunId=` |
| GET | `/api/health` | public | `HealthDto` |
| GET | `/api/llm/models` | OPERATOR | `{ mode, baseUrl, configuredModel, models: string[], reachable }` |
| GET | `/api/openapi.json`, `/api/docs` | public | OpenAPI 3.1 + Swagger UI (bonus) |

Refresh cookie: `agentops_refresh`, HttpOnly, SameSite=Strict, Path=`/api/auth`, Secure when `COOKIE_SECURE=true`.
Access token in memory only (never localStorage). Access TTL default 900 s.

## WebSocket `/ws/messages?ticket=<wsTicket>`

Upgrade rejected with 401 if ticket missing/invalid/expired, 403 if Origin not allowed
(allowed = `ALLOWED_ORIGINS` list, or Origin host equal to request `Host`). Max frame 16 KiB.
Server pings every 25 s; connection closed after 60 s without traffic. Rate limit: 10 msgs / 5 s per connection
(excess → `error` event `rate_limited`). A user may hold several connections (tabs/devices); presence = ≥1 connection.

### Client → server
```json
{"type":"message","destinataireId":2,"contenu":"Bonjour !","clientMessageId":"uuid-optional",
 "expediteurId":1,"dateEnvoi":"2026-09-21T10:15:30"}      // expediteurId/dateEnvoi accepted but IGNORED
{"type":"typing","destinataireId":2,"isTyping":true}
```
`contenu`: trimmed, 1–4000 chars. Recipient must exist and differ from sender.

### Server → client (all have `type`)
```json
{"type":"message","id":42,"expediteurId":1,"destinataireId":2,"contenu":"Bonjour !","dateEnvoi":"2026-09-21T10:15:30Z","clientMessageId":"..."}
   // delivered to recipient's connections AND echoed to all sender connections (authoritative id/timestamp)
{"type":"user_presence","userId":2,"username":"bob","online":true}          // broadcast to everyone
{"type":"typing","expediteurId":1,"destinataireId":2,"isTyping":true}      // to recipient only
{"type":"agent_status","runId":7,"caseId":3,"status":"AWAITING_APPROVAL","updatedAt":"..."}  // to run creator + assigned reviewer
{"type":"approval_requested","approvalId":5,"runId":7,"caseId":3,"caseTitle":"...","riskLevel":"high","proposedAction":"flag_invoice_for_review","requestedBy":1,"createdAt":"..."}  // to assigned reviewer + requester
{"type":"approval_resolved","approvalId":5,"runId":7,"status":"APPROVED","decidedBy":2,"decidedAt":"..."}  // to reviewer + requester
{"type":"error","code":"validation_error","message":"...","clientMessageId":"..."}
```

## Agent state machine

```
PENDING → RUNNING | CANCELLED | FAILED
RUNNING → AWAITING_APPROVAL | COMPLETED | FAILED
AWAITING_APPROVAL → APPROVED | REJECTED | CANCELLED
APPROVED → RUNNING
REJECTED → CANCELLED
COMPLETED, CANCELLED, FAILED: terminal
```
Flow: run created PENDING → worker sets RUNNING → LLM analysis (≤ 2 attempts on invalid output/timeouts) →
validated `AgentAnalysis`. If `recommendedAction` requires approval by **backend policy** (`flag_invoice_for_review` always does),
create approval PENDING, run → AWAITING_APPROVAL. If `no_action` → COMPLETED (audit `action_skipped`).
Any LLM failure → FAILED (never auto-approve). Approve → APPROVED → RUNNING → execute action exactly once
(`action_executions` UNIQUE(approval_id)) → COMPLETED. Reject → REJECTED → CANCELLED, nothing executed.
Startup recovery: PENDING/RUNNING runs without approval → FAILED (`run_recovered`); APPROVED runs (or RUNNING with an
approved approval) → resume execution idempotently.
