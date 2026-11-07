import { AgentAvatar } from '@/components/shared/agent-avatar'
import { UserAvatar } from '@/components/shared/presence'
import { Dot } from '@/components/shared/status'
import { agentForEvent } from '@/features/agents/agents'
import { AUDIT_EVENT_TONE, auditEventLabel } from '@/lib/labels'
import type { AuditEventDto } from '@/lib/types'
import { cn, formatDateTime, formatTime } from '@/lib/utils'
import { auditSummary } from './summary'

/**
 * Vertical event list rendered inside prompt-kit <StepsContent> (the rail comes from <StepsBar>).
 * Each item: human label, actor, summary, time; click to reveal the raw payload (monospace).
 */
export function AuditEventList({ events }: { events: AuditEventDto[] }) {
  return (
    <ol className="space-y-3" data-testid="audit-event-list">
      {events.map((e) => (
        <AuditItem key={e.id} event={e} />
      ))}
    </ol>
  )
}

function AuditItem({ event: e }: { event: AuditEventDto }) {
  const summary = auditSummary(e)
  const hasPayload = e.payload && Object.keys(e.payload).length > 0
  const tone = AUDIT_EVENT_TONE[e.eventType] ?? 'neutral'
  const head = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-13 font-medium text-text">{auditEventLabel(e.eventType)}</p>
        <time
          className="shrink-0 text-xs text-text-tertiary tabular-nums"
          dateTime={e.createdAt}
          title={formatDateTime(e.createdAt)}
        >
          {formatTime(e.createdAt)}
        </time>
      </div>
      <p className="mt-0.5 flex items-start gap-1.5 text-13 text-text-secondary">
        {e.actorUsername ? (
          <UserAvatar username={e.actorUsername} size="xs" className="mt-px scale-[0.83]" />
        ) : (
          <AgentAvatar agent={agentForEvent(e.eventType)} size="xs" className="mt-px scale-[0.83]" />
        )}
        <span className="min-w-0">
          <span className="text-text">{e.actorUsername ?? agentForEvent(e.eventType).name}</span>
          {summary && <> · {summary}</>}
        </span>
      </p>
    </>
  )
  return (
    <li className="relative" data-testid="audit-event" data-event-type={e.eventType}>
      <Dot tone={tone} className="absolute top-[7px] -start-4 size-[7px] ring-2 ring-bg" />
      {hasPayload ? (
        <details className="group">
          <summary
            className="-mx-1.5 cursor-pointer list-none rounded-md px-1.5 py-0.5 transition-colors duration-100 hover:bg-bg-muted [&::-webkit-details-marker]:hidden"
            title="Show raw payload"
          >
            {head}
          </summary>
          <pre
            className={cn(
              'mt-1 max-h-64 overflow-auto overscroll-contain rounded-md bg-bg-subtle p-2.5 font-mono text-[11px] leading-relaxed text-text-secondary',
            )}
          >
            {JSON.stringify(e.payload, null, 2)}
          </pre>
        </details>
      ) : (
        <div className="py-0.5">{head}</div>
      )}
    </li>
  )
}
