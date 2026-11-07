import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      data-testid="empty-state"
      className={cn('flex flex-col items-start gap-1 py-10 text-start sm:items-center sm:text-center', className)}
    >
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-13 text-text-secondary">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  title = 'Could not load data',
  onRetry,
  className,
}: {
  error?: unknown
  title?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" data-testid="error-state" className={cn('flex flex-col items-start gap-1 py-8', className)}>
      <p className="inline-flex items-center gap-2 text-sm font-medium text-text">
        <span aria-hidden className="size-2 rounded-full bg-danger-solid" />
        {title}
      </p>
      {error !== undefined && <p className="max-w-md text-13 text-text-secondary">{errorMessage(error)}</p>}
      {onRetry && (
        <Button size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

/** Row skeleton that mirrors a table/list row (DESIGN: skeletons match the final layout). */
export function RowsSkeleton({
  rows = 5,
  columns = ['w-12', 'w-2/5', 'w-24', 'w-20'],
  className,
}: {
  rows?: number
  columns?: string[]
  className?: string
}) {
  return (
    <div data-testid="loading-state" aria-busy="true" aria-label="Loading" className={cn('divide-y', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-6">
          {columns.map((w, j) => (
            <Skeleton key={j} className={cn('h-3', w, j === 1 && 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Generic list skeleton (contacts, inbox rows). */
export function ListSkeleton({ rows = 5, className, avatar = false }: { rows?: number; className?: string; avatar?: boolean }) {
  return (
    <div data-testid="loading-state" aria-busy="true" aria-label="Loading" className={cn('space-y-1', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          {avatar && <Skeleton className="size-8 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <p className="text-13 text-text-tertiary">{label}</p>
    </div>
  )
}
