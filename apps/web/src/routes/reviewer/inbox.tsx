import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AnimatedBackground } from '@/components/motion-primitives/animated-background'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { DeviationMini, RiskGauge } from '@/components/shared/invoice-visuals'
import { ApprovalStatusBadge } from '@/components/shared/status'
import { runOfApproval } from '@/features/agents/pipeline'
import { PipelineTrack } from '@/features/agents/pipeline-track'
import { useApprovals } from '@/features/approvals/hooks'
import { useDocumentTitle } from '@/lib/hooks'
import { actionLabel } from '@/lib/labels'
import type { ApprovalDto } from '@/lib/types'
import { cn, formatDateTime, formatMoney, formatRelative } from '@/lib/utils'
import { useRealtimeStore } from '@/stores/realtime'

type Filter = 'pending' | 'decided' | 'all'

export function ReviewerInbox() {
  const [filter, setFilter] = useState<Filter>('pending')
  const approvals = useApprovals()
  const fresh = useRealtimeStore((s) => s.freshApprovals)

  const all = approvals.data?.items ?? []
  const pending = all.filter((a) => a.status === 'PENDING')
  const decided = all.filter((a) => a.status !== 'PENDING')
  const items = filter === 'pending' ? pending : filter === 'decided' ? decided : all
  useDocumentTitle(pending.length ? `Inbox (${pending.length})` : 'Inbox')

  const tabs: [Filter, string, number][] = [
    ['pending', 'Pending', pending.length],
    ['decided', 'Decided', decided.length],
    ['all', 'All', all.length],
  ]

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Approval inbox" />

      <div
        className="mb-4 inline-flex rounded-lg bg-bg-muted p-0.5"
        role="tablist"
        aria-label="Filter approvals"
      >
        <AnimatedBackground
          value={filter}
          onValueChange={(id) => id && setFilter(id as Filter)}
          className="rounded-md bg-bg-surface shadow-border"
          transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        >
          {tabs.map(([value, label, n]) => (
            <button
              key={value}
              data-id={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              data-testid={`inbox-filter-${value}`}
              className={cn(
                'h-8 rounded-md px-3 text-13 transition-colors duration-150',
                filter === value ? 'font-medium text-text' : 'text-text-secondary hover:text-text',
              )}
            >
              {label}
              {approvals.data && <span className="text-text-tertiary tabular-nums">{n}</span>}
            </button>
          ))}
        </AnimatedBackground>
      </div>

      {approvals.isPending ? (
        <ListSkeleton rows={4} />
      ) : approvals.isError ? (
        <ErrorState error={approvals.error} onRetry={() => void approvals.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          className="sm:items-start sm:text-start"
          title={filter === 'pending' ? 'You’re all caught up' : 'Nothing here yet'}
          description={
            filter === 'pending'
              ? 'New requests appear here the moment an operator runs an analysis.'
              : 'Approvals assigned to you are listed here.'
          }
        />
      ) : (
        <ul className="space-y-2" data-testid="approval-list">
          {items.map((a) => (
            <ApprovalRow key={a.id} approval={a} fresh={Boolean(fresh[a.id])} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}

function ApprovalRow({ approval: a, fresh }: { approval: ApprovalDto; fresh: boolean }) {
  const pending = a.status === 'PENDING'
  return (
    <li>
      <Link
        to="/reviewer/approvals/$approvalId"
        params={{ approvalId: String(a.id) }}
        data-testid={`approval-card-${a.id}`}
        data-fresh={fresh ? 'true' : 'false'}
        className={cn(
          'group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-xl p-4 transition-[box-shadow,background-color] duration-150',
          'shadow-border hover:shadow-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'sm:grid-cols-[auto_minmax(0,1fr)_auto]',
          pending ? 'bg-bg-surface' : 'bg-bg-subtle',
        )}
      >
        <div className="flex w-20 justify-center">
          <RiskGauge level={a.riskLevel} size={64} className={cn(!pending && 'opacity-70')} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className={cn('truncate text-sm', pending ? 'font-medium text-text' : 'text-text-secondary')} title={a.caseTitle}>
            {fresh && (
              <span className="me-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-accent-solid align-middle" aria-label="New" />
            )}
            {a.caseTitle}
          </p>
          <p className="truncate text-13 text-text-secondary">
            {actionLabel(a.proposedAction)} · {a.invoice.vendor}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-text-tertiary">
            <PipelineTrack run={runOfApproval(a)} compact />
            <span className="truncate">
              From {a.requestedByUsername} ·{' '}
              <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)} className="tabular-nums">
                {formatRelative(a.createdAt)}
              </time>
            </span>
            {!pending && <ApprovalStatusBadge status={a.status} className="text-xs text-text-secondary" />}
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:flex-col sm:items-end sm:gap-1.5">
          <span className="text-base font-semibold tracking-[-0.01em] tabular-nums">{formatMoney(a.invoice.amount, a.invoice.currency)}</span>
          <DeviationMini invoice={a.invoice} />
        </div>
      </Link>
    </li>
  )
}
