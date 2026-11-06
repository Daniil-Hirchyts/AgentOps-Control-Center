import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { AnimatedBackground } from '@/components/motion-primitives/animated-background'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { ApprovalStatusBadge, Dot } from '@/components/shared/status'
import { useApprovals } from '@/features/approvals/hooks'
import { useDocumentTitle } from '@/lib/hooks'
import { actionLabel, RISK } from '@/lib/labels'
import type { ApprovalDto } from '@/lib/types'
import { cn, deviation, formatDateTime, formatMoney, formatRelative } from '@/lib/utils'
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
      <PageHeader title="Approval inbox" meta="Actions the agent wants to take. Nothing runs until you decide." />

      <div
        className="mb-4 inline-flex rounded-lg bg-bg-muted p-0.5"
        role="tablist"
        aria-label="Filter approvals"
      >
        <AnimatedBackground
          value={filter}
          onValueChange={(id) => id && setFilter(id as Filter)}
          className="rounded-md bg-surface shadow-elevated"
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
        <ListSkeleton rows={4} className="divide-y border-y" />
      ) : approvals.isError ? (
        <ErrorState error={approvals.error} onRetry={() => void approvals.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          className="border-t sm:items-start sm:text-left"
          title={filter === 'pending' ? 'You’re all caught up' : 'Nothing here yet'}
          description={
            filter === 'pending'
              ? 'New requests appear here the moment an operator runs an analysis.'
              : 'Approvals assigned to you are listed here.'
          }
        />
      ) : (
        <ul className="divide-y border-y" data-testid="approval-list">
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
  const ratio = deviation(a.invoice)
  const risk = RISK[a.riskLevel]
  return (
    <li>
      <Link
        to="/reviewer/approvals/$approvalId"
        params={{ approvalId: String(a.id) }}
        data-testid={`approval-card-${a.id}`}
        data-fresh={fresh ? 'true' : 'false'}
        className="group -mx-4 flex items-center gap-3 px-4 py-3.5 transition-colors duration-100 hover:bg-bg-subtle focus-visible:-outline-offset-2 sm:-mx-3 sm:rounded-md sm:px-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className={cn('truncate text-sm', pending ? 'font-medium text-text' : 'text-text-secondary')} title={a.caseTitle}>
              {fresh && (
                <span className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-accent-solid align-middle" aria-label="New" />
              )}
              {a.caseTitle}
            </p>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {formatMoney(a.invoice.amount, a.invoice.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-13 text-text-secondary">
            <span className="flex min-w-0 items-center gap-1.5">
              <Dot tone={risk.tone} />
              <span className="truncate">
                {risk.label} · {actionLabel(a.proposedAction)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              {ratio !== null && ratio >= 1.5 ? `${ratio.toFixed(1)}× avg` : a.invoice.vendor}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-text-tertiary">
            <span className="truncate">
              From {a.requestedByUsername} ·{' '}
              <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)} className="tabular-nums">
                {formatRelative(a.createdAt)}
              </time>
            </span>
            {!pending && <ApprovalStatusBadge status={a.status} className="text-xs text-text-secondary" />}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
      </Link>
    </li>
  )
}
