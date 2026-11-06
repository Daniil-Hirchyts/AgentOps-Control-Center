import type { ApprovalStatus, Id, RunStatus } from './types'

/** Centralised TanStack Query keys. Prefix arrays allow broad invalidation. */
export const qk = {
  me: ['me'] as const,
  users: ['users'] as const,
  conversation: (userId: Id) => ['messages', userId] as const,
  conversations: ['messages'] as const,
  cases: ['cases'] as const,
  caseList: (q: object = {}) => ['cases', 'list', q] as const,
  case: (id: Id) => ['cases', 'detail', id] as const,
  runs: ['runs'] as const,
  runList: (q: { status?: RunStatus; caseId?: Id; limit?: number } = {}) => ['runs', 'list', q] as const,
  run: (id: Id) => ['runs', 'detail', id] as const,
  approvals: ['approvals'] as const,
  approvalList: (q: { status?: ApprovalStatus; limit?: number } = {}) => ['approvals', 'list', q] as const,
  approval: (id: Id) => ['approvals', 'detail', id] as const,
  audit: ['audit'] as const,
  auditList: (q: { agentRunId?: Id; limit?: number; offset?: number } = {}) => ['audit', 'list', q] as const,
}
