import { Dot } from '@/components/shared/status'
import type { Tone } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useRealtimeStore } from '@/stores/realtime'

const LABEL = {
  idle: 'Offline',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  offline: 'No network',
} as const

const TONE: Record<keyof typeof LABEL, Tone> = {
  idle: 'muted',
  connecting: 'progress',
  connected: 'success',
  reconnecting: 'warning',
  offline: 'danger',
}

/** Realtime connection status: dot + text (text visually hidden in compact mode). */
export function ConnectionStatus({
  className,
  compact = false,
  quiet = false,
  testId = 'ws-status',
}: {
  className?: string
  compact?: boolean
  /** Say nothing visible while connected; only problems are worth the space. */
  quiet?: boolean
  testId?: string
}) {
  const status = useRealtimeStore((s) => s.wsStatus)
  if (quiet && status === 'connected') {
    return (
      <span data-testid={testId} data-status={status} role="status" aria-live="polite" className="sr-only">
        {LABEL[status]}
      </span>
    )
  }
  return (
    <span
      data-testid={testId}
      data-status={status}
      role="status"
      aria-live="polite"
      title={`Realtime: ${LABEL[status]}`}
      className={cn('inline-flex items-center gap-2 text-13 text-text-secondary', className)}
    >
      <Dot tone={TONE[status]} />
      <span className={cn(compact && 'sr-only')}>{LABEL[status]}</span>
    </span>
  )
}
