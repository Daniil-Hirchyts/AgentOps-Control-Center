import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRealtimeStore } from '@/stores/realtime'

const LABEL = {
  idle: 'Offline',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  offline: 'No network',
} as const

export function ConnectionPill({
  className,
  compact = false,
  testId = 'ws-status',
}: {
  className?: string
  compact?: boolean
  testId?: string
}) {
  const status = useRealtimeStore((s) => s.wsStatus)
  const ok = status === 'connected'
  const pending = status === 'connecting' || status === 'reconnecting'
  return (
    <span
      data-testid={testId}
      data-status={status}
      role="status"
      aria-live="polite"
      title={`Realtime: ${LABEL[status]}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        ok && 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
        pending && 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
        !ok && !pending && 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
        className,
      )}
    >
      {ok ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      ) : pending ? (
        <Wifi className="size-3 animate-pulse" />
      ) : (
        <WifiOff className="size-3" />
      )}
      <span className={cn(compact && 'sr-only sm:not-sr-only')}>{LABEL[status]}</span>
    </span>
  )
}
