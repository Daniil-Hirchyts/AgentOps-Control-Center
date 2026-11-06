import { useAuthStore } from '@/stores/auth'
import type {
  AccountCreated,
  AgentRunDto,
  ApiErrorBody,
  ApprovalDto,
  ApprovalStatus,
  AuditEventDto,
  CaseDto,
  CreateCaseRequest,
  CreateRunRequest,
  DecisionRequest,
  HealthDto,
  Id,
  LoginRequest,
  LoginResponse,
  MessageDto,
  Page,
  PageQuery,
  RegisterRequest,
  RunStatus,
  UserDto,
  WsTicket,
} from './types'

export const API_BASE = '/api'
const CSRF_HEADER = { 'X-Requested-With': 'agentops' } as const

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isConflict() {
    return this.status === 409
  }
  get isNotFound() {
    return this.status === 404
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  /** Attach the bearer token and attempt a silent refresh on 401 (default true). */
  auth?: boolean
  signal?: AbortSignal
  headers?: Record<string, string>
}

let authFailureHandler: (() => void) | null = null
/** Called when the session cannot be recovered (refresh failed). Wired by the router. */
export function setAuthFailureHandler(fn: (() => void) | null) {
  authFailureHandler = fn
}

function buildUrl(path: string, query?: Query): string {
  let url = `${API_BASE}${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  return url
}

async function parseError(res: Response): Promise<ApiError> {
  let code = statusToCode(res.status)
  let message = res.statusText || `Request failed (${res.status})`
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>
    if (body?.error?.code) code = body.error.code
    if (body?.error?.message) message = body.error.message
  } catch {
    // non-JSON error body — keep defaults
  }
  return new ApiError(res.status, code, message)
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 422:
      return 'validation_error'
    case 429:
      return 'rate_limited'
    case 503:
      return 'llm_unavailable'
    default:
      return status >= 500 ? 'internal' : 'unknown'
  }
}

async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

let refreshInFlight: Promise<LoginResponse | null> | null = null

/**
 * Silently refresh the access token using the HttpOnly refresh cookie.
 * Concurrent callers share one in-flight request (the server rotates the cookie).
 */
export function refreshSession(): Promise<LoginResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...CSRF_HEADER },
        })
        if (!res.ok) return null
        const session = await readBody<LoginResponse>(res)
        useAuthStore.getState().setSession(session)
        return session
      } catch {
        return null
      } finally {
        // allow a later refresh once this one settled
        queueMicrotask(() => {
          refreshInFlight = null
        })
      }
    })()
  }
  return refreshInFlight
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal, headers = {} } = opts

  const send = () => {
    const h: Record<string, string> = { Accept: 'application/json', ...headers }
    if (body !== undefined) h['Content-Type'] = 'application/json'
    const token = useAuthStore.getState().accessToken
    if (auth && token) h.Authorization = `Bearer ${token}`
    return fetch(buildUrl(path, query), {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    })
  }

  let res = await send()
  if (res.status === 401 && auth) {
    const session = await refreshSession()
    if (session) {
      res = await send()
    } else {
      useAuthStore.getState().clear()
      authFailureHandler?.()
      throw await parseError(res)
    }
  }
  if (!res.ok) throw await parseError(res)
  return readBody<T>(res)
}

// ---------------------------------------------------------------------------
// Endpoint helpers (one per contract row)
// ---------------------------------------------------------------------------

export const api = {
  // auth
  register: (body: RegisterRequest) =>
    request<AccountCreated>('/comptes', { method: 'POST', body, auth: false }),
  login: (body: LoginRequest) => request<LoginResponse>('/auth/login', { method: 'POST', body, auth: false }),
  logout: () =>
    request<void>('/auth/logout', { method: 'POST', auth: false, headers: { ...CSRF_HEADER } }),
  me: () => request<UserDto>('/auth/me'),
  wsTicket: () => request<WsTicket>('/auth/ws-ticket', { method: 'POST' }),

  // university messaging
  users: () => request<UserDto[]>('/utilisateurs'),
  messages: (userId: Id, q?: { limit?: number; beforeId?: Id }) =>
    request<MessageDto[]>(`/messages/${userId}`, { query: q }),

  // cases
  cases: (q?: PageQuery) => request<Page<CaseDto>>('/cases', { query: { ...q } }),
  case: (id: Id) => request<CaseDto>(`/cases/${id}`),
  createCase: (body: CreateCaseRequest) => request<CaseDto>('/cases', { method: 'POST', body }),

  // runs
  runs: (q?: PageQuery & { status?: RunStatus; caseId?: Id }) =>
    request<Page<AgentRunDto>>('/agent-runs', { query: { ...q } }),
  run: (id: Id) => request<AgentRunDto>(`/agent-runs/${id}`),
  createRun: (body: CreateRunRequest) => request<AgentRunDto>('/agent-runs', { method: 'POST', body }),

  // approvals
  approvals: (q?: PageQuery & { status?: ApprovalStatus }) =>
    request<Page<ApprovalDto>>('/approvals', { query: { ...q } }),
  approval: (id: Id) => request<ApprovalDto>(`/approvals/${id}`),
  decide: (id: Id, body: DecisionRequest) =>
    request<ApprovalDto>(`/approvals/${id}/decision`, { method: 'POST', body }),

  // audit
  auditEvents: (q?: PageQuery & { agentRunId?: Id }) =>
    request<Page<AuditEventDto>>('/audit-events', { query: { ...q } }),

  health: () => request<HealthDto>('/health', { auth: false }),
}
