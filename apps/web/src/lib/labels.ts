/**
 * Human labels for every backend enum / identifier shown in the UI (DESIGN.md §1).
 * Raw ids never appear as copy; they may only appear in a secondary monospace detail.
 */
import type { ActionName, ApprovalStatus, CaseStatus, LlmMode, RiskLevel, Role, RunStatus } from './types'
import { humanize } from './utils'

export type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger' | 'muted'

export interface StatusMeta {
  label: string
  tone: Tone
}

export const RUN_STATUS: Record<RunStatus, StatusMeta> = {
  PENDING: { label: 'Queued', tone: 'neutral' },
  RUNNING: { label: 'Analyzing', tone: 'progress' },
  AWAITING_APPROVAL: { label: 'Awaiting approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
  FAILED: { label: 'Failed', tone: 'danger' },
}

export const APPROVAL_STATUS: Record<ApprovalStatus, StatusMeta> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
}

export const CASE_STATUS: Record<CaseStatus, StatusMeta> = {
  OPEN: { label: 'Open', tone: 'neutral' },
  FLAGGED_FOR_REVIEW: { label: 'Flagged for review', tone: 'warning' },
  CLOSED: { label: 'Closed', tone: 'muted' },
}

export const RISK: Record<RiskLevel, StatusMeta> = {
  low: { label: 'Low risk', tone: 'success' },
  medium: { label: 'Medium risk', tone: 'warning' },
  high: { label: 'High risk', tone: 'danger' },
}

export const ACTION_LABEL: Record<ActionName, string> = {
  flag_invoice_for_review: 'Flag invoice for review',
  no_action: 'No action',
}

export const ACTION_EXPLANATION: Record<ActionName, string> = {
  flag_invoice_for_review:
    'Approving marks the case “Flagged for review” in the synthetic case database. No external system is touched. Rejecting executes nothing and cancels the run.',
  no_action: 'The agent found nothing to act on. Approving confirms that no action is taken.',
}

export const AUDIT_EVENT_LABEL: Record<string, string> = {
  run_created: 'Run created',
  run_status_changed: 'Status changed',
  llm_request: 'Model request sent',
  llm_response_valid: 'Model response validated',
  llm_response_invalid: 'Model response rejected',
  llm_error: 'Model error',
  approval_requested: 'Approval requested',
  approval_decided: 'Approval decided',
  action_executed: 'Action executed',
  action_skipped: 'Action skipped',
  run_recovered: 'Run recovered',
}

export const AUDIT_EVENT_TONE: Record<string, Tone> = {
  llm_response_invalid: 'warning',
  llm_error: 'danger',
  approval_requested: 'warning',
  action_executed: 'success',
}

export const ROLE_LABEL: Record<Role, string> = { OPERATOR: 'Operator', REVIEWER: 'Reviewer' }

export const LLM_MODE_LABEL: Record<LlmMode, string> = { real: 'Live model', mock: 'Mock model' }

export function runStatusLabel(s: string): string {
  return (RUN_STATUS as Record<string, StatusMeta>)[s]?.label ?? humanize(s)
}
export function approvalStatusLabel(s: string): string {
  return (APPROVAL_STATUS as Record<string, StatusMeta>)[s]?.label ?? humanize(s)
}
export function actionLabel(a: string): string {
  return (ACTION_LABEL as Record<string, string>)[a] ?? humanize(a)
}
export function riskLabel(r: string): string {
  return (RISK as Record<string, StatusMeta>)[r]?.label ?? `${humanize(r)} risk`
}
export function auditEventLabel(t: string): string {
  return AUDIT_EVENT_LABEL[t] ?? humanize(t)
}
