# AgentOps Control Center — Web

React 19 + TypeScript (strict) SPA for the AgentOps Control Center: real-time messaging between
operators and reviewers, plus a human-in-the-loop approval dashboard for AI agent runs.
Everything follows `contracts/CONTRACT.md`.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173 (also exposed on the LAN for the phone demo)
```

The dev server proxies `/api` and `/ws` to the backend on `http://localhost:8080`
(override with `VITE_BACKEND_URL`). `changeOrigin` is deliberately **not** set, because the backend
checks that the WebSocket `Origin` host equals the `Host` header.

Demo accounts (synthetic seed data): `alice`, `carol` (operators), `bob`, `dave` (reviewers), password
`demo-password-123`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm preview` | Vite dev server / production build / preview |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | ESLint (typescript-eslint + react-hooks + react-refresh) |
| `pnpm test` | Vitest + React Testing Library (jsdom) |
| `pnpm gen:api` | Generate `src/generated/api.ts` from `contracts/openapi/openapi.json` |

## Architecture

```
src/
  app.tsx, main.tsx, router.tsx   bootstrap (session restore → router), code-based TanStack Router tree + guards
  routes/                         page components (login, register, operator/*, reviewer/*, messages)
  features/                       auth · agents · cases · approvals · messaging · audit (hooks + components)
  components/ui/                  shadcn-style primitives (Radix + cva)
  components/layout|shared/       app shell, nav, badges, empty/error/loading states, presence
  lib/                            api client, ws client, Zod WS schemas, realtime handlers, DTO types
  stores/                         Zustand: auth (token in memory only), realtime (ws status, typing, unread), ui
```

- **Auth**: access token lives only in memory (Zustand). On boot, `POST /api/auth/refresh` restores the session
  from the HttpOnly cookie. Any 401 triggers one silent refresh + retry; if that fails the user is sent to `/login`.
- **Realtime**: one native WebSocket per signed-in tab, authenticated with a short-lived ticket
  (`POST /api/auth/ws-ticket`, fresh on every reconnect), exponential backoff, every frame Zod-validated
  (unknown types ignored). On (re)connect, users/conversations/runs/approvals/cases queries are invalidated.
- **Messaging**: REST history + WS live updates, optimistic sends reconciled by `clientMessageId`,
  failure on `error` events / timeout / closed socket with retry, typing indicators, unread counters.
- **Types**: shared API types are exported from `src/lib/types.ts`; the DTO aliases already reference
  `src/generated/api.ts`. Run `pnpm gen:api` after updating the OpenAPI schema.

## Test ids used by E2E

`login-username`, `login-password`, `login-submit`, `register-*`, `message-input`, `send-button`,
`message-bubble` (`data-mine`, `data-delivery`), `contact-<username>`, `presence-<username>` (`data-online`),
`ws-status` (`data-status`), `run-status` (`data-status`), `approve-button`, `reject-button`,
`confirm-decision`, `decision-reason`, `approval-status`, `notification-bell`, `notification-count`,
`run-analysis-button`, `reviewer-option-<username>`, `start-run-submit`, `new-case-button`, `prefill-sample`,
`create-case-submit`, `typing-indicator`, `logout-button`, `user-menu`.
