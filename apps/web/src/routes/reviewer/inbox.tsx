import { Link } from '@tanstack/react-router'
import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { UserAvatar } from '@/components/shared/presence'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { ApprovalStatusBadge, RiskBadge } from '@/components/shared/status-badge'
import { useApprovals } from '@/features/approvals/hooks'
import type { ApprovalDto } from '@/lib/types'
import { cn, formatMoney, formatRelative } from '@/lib/utils'
import { useRealtimeStore } from '@/stores/realtime'

type Filter = 'pending' | 'all'

export function ReviewerInbox() {
  const [filter, setFilter] = useState<Filter>('pending')
  const approvals = useApprovals()
  const fresh = useRealtimeStore((s) => s.freshApprovals)

  const all = approvals.data?.items ?? []
  const pendingCount = all.filter((a) => a.status === 'PENDING').length
  const items = filter === 'pending' ? all.filter((a) => a.status === 'PENDING') : all

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Approval inbox"
        description="Actions proposed by the AI agent that need your decision."
      />
      <div className="mb-4 inline-flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Filter approvals">
        {(
          [
            ['pending', `Pending${approvals.data ? ` (${pendingCount})` : ''}`],
            ['all', `All${approvals.data ? ` (${all.length})` : ''}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            data-testid={`inbox-filter-${value}`}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === value ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {approvals.isPending ? (
        <ListSkeleton rows={4} className="[&>*]:h-24" />
      ) : approvals.isError ? (
        <ErrorState error={approvals.error} onRetry={() => void approvals.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={filter === 'pending' ? 'All caught up' : 'No approvals yet'}
          description={
            filter === 'pending'
              ? 'New requests appear here instantly when an operator runs an analysis.'
              : 'Approval requests assigned to you will be listed here.'
          }
        />
      ) : (
        <ul className="space-y-3" data-testid="approval-list">
          {items.map((a) => (
            <ApprovalCard key={a.id} approval={a} fresh={Boolean(fresh[a.id])} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}

function ApprovalCard({ approval: a, fresh }: { approval: ApprovalDto; fresh: boolean }) {
  const pending = a.status === 'PENDING'
  return (
    <li>
      <Link
        to="/reviewer/approvals/$approvalId"
        params={{ approvalId: String(a.id) }}
        data-testid={`approval-card-${a.id}`}
        data-fresh={fresh ? 'true' : 'false'}
        className={cn(
          'group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all outline-none hover:border-primary/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50',
          fresh && 'border-primary/50 ring-2 ring-primary/20',
          !pending && 'opacity-80',
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {fresh && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
                New
              </span>
            )}
            <RiskBadge level={a.riskLevel} />
            {!pending && <ApprovalStatusBadge status={a.status} />}
          </div>
          <p className="truncate font-semibold">{a.caseTitle}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formatMoney(a.invoice.amount, a.invoice.currency)}
            </span>
            <span className="truncate">{a.invoice.vendor}</span>
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar username={a.requestedByUsername} size="sm" className="scale-75" />
              {a.requestedByUsername}
            </span>
            <span title={a.createdAt}>{formatRelative(a.createdAt)}</span>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}
