import type { AuditEventDto } from '@/lib/types'
import { humanize } from '@/lib/utils'

/** One-line human summary of an audit event payload (payload shape is backend-defined). */
export function auditSummary(e: AuditEventDto): string | null {
  const p = e.payload ?? {}
  const str = (k: string) => (typeof p[k] === 'string' || typeof p[k] === 'number' ? String(p[k]) : null)
  switch (e.eventType) {
    case 'run_status_changed': {
      const from = str('from') ?? str('fromStatus') ?? str('previous')
      const to = str('to') ?? str('toStatus') ?? str('status')
      return from && to ? `${humanize(from)} → ${humanize(to)}` : to ? `→ ${humanize(to)}` : null
    }
    case 'approval_decided':
      return [str('decision') ?? str('status'), str('reason')].filter(Boolean).join(' — ') || null
    case 'llm_error':
    case 'llm_response_invalid':
      return str('error') ?? str('message') ?? str('reason')
    case 'llm_request':
      return [str('model'), str('attempt') && `attempt ${str('attempt')}`].filter(Boolean).join(' · ') || null
    default:
      return str('action') ?? str('message') ?? null
  }
}
