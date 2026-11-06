import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  FileCheck2,
  type LucideIcon,
  PlayCircle,
  RefreshCcw,
  Send,
  SkipForward,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import type { AuditEventDto } from '@/lib/types'
import { cn, formatDateTime, humanize } from '@/lib/utils'
import { auditSummary } from './summary'

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  run_created: { icon: PlayCircle, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300' },
  run_status_changed: { icon: CircleDot, tone: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300' },
  llm_request: { icon: Send, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300' },
  llm_response_valid: { icon: Bot, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300' },
  llm_response_invalid: { icon: AlertTriangle, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300' },
  llm_error: { icon: XCircle, tone: 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-300' },
  approval_requested: { icon: UserCheck, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300' },
  approval_decided: { icon: FileCheck2, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300' },
  action_executed: { icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300' },
  action_skipped: { icon: SkipForward, tone: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300' },
  run_recovered: { icon: RefreshCcw, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300' },
}

export function AuditEventList({ events }: { events: AuditEventDto[] }) {
  return (
    <ol className="relative space-y-4" data-testid="audit-event-list">
      {events.map((e, i) => (
        <AuditItem key={e.id} event={e} last={i === events.length - 1} />
      ))}
    </ol>
  )
}

function AuditItem({ event: e, last }: { event: AuditEventDto; last: boolean }) {
  const [open, setOpen] = useState(false)
  const meta = ICONS[e.eventType] ?? { icon: CircleDot, tone: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800' }
  const Icon = meta.icon
  const summary = auditSummary(e)
  const hasPayload = e.payload && Object.keys(e.payload).length > 0
  return (
    <li className="relative flex gap-3" data-testid="audit-event" data-event-type={e.eventType}>
      {!last && <span className="absolute top-8 bottom-[-1rem] left-[15px] w-px bg-border" aria-hidden />}
      <span className={cn('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full', meta.tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-medium">{humanize(e.eventType)}</p>
          <time className="text-xs text-muted-foreground" dateTime={e.createdAt}>
            {formatDateTime(e.createdAt)}
          </time>
        </div>
        <p className="text-xs text-muted-foreground">
          {e.actorUsername ? `by ${e.actorUsername}` : 'system'}
          {summary && <> · {summary}</>}
        </p>
        {hasPayload && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 text-xs text-primary hover:underline"
            aria-expanded={open}
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
        )}
        {open && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed">
            {JSON.stringify(e.payload, null, 2)}
          </pre>
        )}
      </div>
    </li>
  )
}
