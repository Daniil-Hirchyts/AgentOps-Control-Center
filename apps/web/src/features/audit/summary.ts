import { actionLabel, approvalStatusLabel, runStatusLabel } from '@/lib/labels'
import type { AuditEventDto } from '@/lib/types'

/** One-line human summary of an audit event payload (payload shape is backend-defined). */
export function auditSummary(e: AuditEventDto): string | null {
  const p = e.payload ?? {}
  const str = (k: string) => (typeof p[k] === 'string' || typeof p[k] === 'number' ? String(p[k]) : null)
  switch (e.eventType) {
    case 'run_status_changed': {
      const from = str('from') ?? str('fromStatus') ?? str('previous')
      const to = str('to') ?? str('toStatus') ?? str('status')
      return from && to ? `${runStatusLabel(from)} → ${runStatusLabel(to)}` : to ? `→ ${runStatusLabel(to)}` : null
    }
    case 'approval_decided': {
      const raw = (str('decision') ?? str('status'))?.toUpperCase()
      const status = raw === 'APPROVE' ? 'APPROVED' : raw === 'REJECT' ? 'REJECTED' : raw
      const reason = str('reason')
      return [status && approvalStatusLabel(status), reason && `“${reason}”`].filter(Boolean).join(' — ') || null
    }
    case 'llm_error':
    case 'llm_response_invalid':
      return str('error') ?? str('message') ?? str('reason')
    case 'llm_request':
      return [str('model'), str('attempt') && `attempt ${str('attempt')}`].filter(Boolean).join(' · ') || null
    case 'approval_requested':
    case 'action_executed':
    case 'action_skipped': {
      const a = str('action') ?? str('proposedAction')
      return a ? actionLabel(a) : (str('message') ?? null)
    }
    default: {
      const a = str('action')
      return a ? actionLabel(a) : (str('message') ?? null)
    }
  }
}
