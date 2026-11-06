import { describe, expect, it } from 'vitest'
import { auditSummary } from '@/features/audit/summary'
import type { AuditEventDto } from './types'
import { actionLabel, auditEventLabel, riskLabel, runStatusLabel } from './labels'

const ev = (eventType: string, payload: Record<string, unknown>): AuditEventDto => ({
  id: 1,
  agentRunId: 1,
  actorId: null,
  actorUsername: null,
  eventType,
  payload,
  createdAt: '2026-09-21T10:15:30Z',
})

describe('human labels', () => {
  it('never shows raw identifiers', () => {
    expect(auditEventLabel('llm_response_valid')).toBe('Model response validated')
    expect(auditEventLabel('action_executed')).toBe('Action executed')
    expect(auditEventLabel('something_new')).toBe('Something new')
    expect(actionLabel('flag_invoice_for_review')).toBe('Flag invoice for review')
    expect(runStatusLabel('AWAITING_APPROVAL')).toBe('Awaiting approval')
    expect(riskLabel('high')).toBe('High risk')
  })

  it('summarises payloads in sentence case', () => {
    expect(auditSummary(ev('run_status_changed', { from: 'RUNNING', to: 'AWAITING_APPROVAL' }))).toBe(
      'Analyzing → Awaiting approval',
    )
    expect(auditSummary(ev('approval_decided', { decision: 'approve', reason: 'ok' }))).toBe('Approved — “ok”')
    expect(auditSummary(ev('action_executed', { action: 'flag_invoice_for_review' }))).toBe('Flag invoice for review')
  })
})
