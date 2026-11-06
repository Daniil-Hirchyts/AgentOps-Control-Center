/**
 * API DTO types.
 *
 * All application code must import API types from this module only.
 * DTOs are aliases of the OpenAPI types generated from the Rust backend
 * (`pnpm gen:api` → src/generated/api.ts). Do not hand-edit those shapes here.
 */

import type { components } from '@/generated/api'

type Schemas = components['schemas']

export type Id = number
/** RFC 3339 UTC timestamp, e.g. `2026-09-21T10:15:30Z`. */
export type Timestamp = string

export type Role = Schemas['Role']
export const ROLES = ['OPERATOR', 'REVIEWER'] as const satisfies readonly Role[]

export type UserDto = Schemas['UserDto']

export type AccountCreated = Schemas['AccountCreated']

export type RegisterRequest = Schemas['CreateAccountRequest']

export type LoginRequest = Schemas['LoginRequest']

export type LoginResponse = Schemas['LoginResponse']

export type WsTicket = Schemas['WsTicket']

/** French field names per the university assignment. */
export type MessageDto = Schemas['MessageDto']

export type InvoiceInput = Schemas['InvoiceInput']

export type CaseStatus = Schemas['CaseStatus']

export type CaseDto = Schemas['CaseDto']

export type CreateCaseRequest = Schemas['CreateCaseRequest']

export type RunStatus = Schemas['RunStatus']

export const RUN_STATUSES = [
  'PENDING',
  'RUNNING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
] as const satisfies readonly RunStatus[]

export type RiskLevel = Schemas['RiskLevel']
export type ActionName = Schemas['ActionName']
export type LlmMode = Schemas['LlmMode']

export type AgentAnalysis = Schemas['AgentAnalysis']

export type ApprovalStatus = Schemas['ApprovalStatus']

export type ApprovalDto = Schemas['ApprovalDto']

export type AgentRunDto = Schemas['AgentRunDto']

export type CreateRunRequest = Schemas['CreateRunRequest']

export type DecisionRequest = Schemas['DecisionRequest']

export type AuditEventType =
  | 'run_created'
  | 'run_status_changed'
  | 'llm_request'
  | 'llm_response_valid'
  | 'llm_response_invalid'
  | 'llm_error'
  | 'approval_requested'
  | 'approval_decided'
  | 'action_executed'
  | 'action_skipped'
  | 'run_recovered'

export interface AuditEventDto {
  id: Id
  agentRunId: Id | null
  actorId: Id | null
  actorUsername: string | null
  /** One of AuditEventType, kept open-ended for forward compatibility. */
  eventType: AuditEventType | (string & {})
  payload: Record<string, unknown>
  createdAt: Timestamp
}

export type HealthDto = Schemas['HealthDto']

export type LlmModelsDto = Schemas['LlmModelsDto']

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface PageQuery {
  limit?: number
  offset?: number
}

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'bad_request'
  | 'rate_limited'
  | 'internal'
  | 'llm_unavailable'

export interface ApiErrorBody {
  error: { code: ApiErrorCode | (string & {}); message: string }
}
