import { Link } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/app-shell'
import { SlidingNumber } from '@/components/motion-primitives/sliding-number'
import { PageHeader, Section } from '@/components/shared/page-header'
import { RowLink, rowLinkClass } from '@/components/shared/row-link'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { RunStatusBadge } from '@/components/shared/status'
import { Skeleton } from '@/components/ui/skeleton'
import { isRunActive, useRuns } from '@/features/agents/hooks'
import { RunsTable } from '@/features/agents/runs-table'
import { useCases } from '@/features/cases/hooks'
import { NewCaseDialog } from '@/features/cases/new-case-dialog'
import { useDocumentTitle } from '@/lib/hooks'
import { riskLabel } from '@/lib/labels'
import type { AgentRunDto, RunStatus } from '@/lib/types'
import { cn, formatDateTime, formatMoney, formatRelative } from '@/lib/utils'

function Metric({
  label,
  value,
  loading,
  to,
  search,
  testId,
  index,
}: {
  label: string
  value: number | undefined
  loading: boolean
  to: string
  search?: { status?: RunStatus }
  testId: string
  index: number
}) {
  return (
    <Link
      to={to}
      search={search}
      data-testid={testId}
      className={cn(
        'group flex flex-col gap-1 py-4 pr-4 transition-colors duration-100 hover:bg-bg-subtle sm:pr-6',
        // 2×2 on phones, one row from sm; first column sits flush with the page edge
        index % 2 === 0 ? 'pl-0' : 'border-l pl-4',
        index < 2 && 'border-b sm:border-b-0',
        index === 0 ? 'sm:pl-0' : 'sm:border-l sm:pl-6',
      )}
    >
      <span className="text-13 text-text-secondary group-hover:text-text">{label}</span>
      {loading || value === undefined ? (
        <Skeleton className="my-1.5 h-6 w-10" />
      ) : (
        <span className="text-2xl font-semibold tracking-[-0.015em] tabular-nums">
          <span className="sr-only">{value}</span>
          <SlidingNumber value={value} />
        </span>
      )}
    </Link>
  )
}

export function OperatorDashboard() {
  useDocumentTitle('Overview')
  const runs = useRuns()
  const cases = useCases()

  const items = runs.data?.items ?? []
  const count = (pred: (r: AgentRunDto) => boolean) => (runs.data ? items.filter(pred).length : undefined)
  const awaiting = items.filter((r) => r.status === 'AWAITING_APPROVAL')
  const failed = items.filter((r) => r.status === 'FAILED')
  const attention = [...awaiting, ...failed].slice(0, 6)
  const flagged = cases.data?.items.filter((c) => c.status === 'FLAGGED_FOR_REVIEW').length

  return (
    <PageContainer>
      <PageHeader title="Overview" actions={<NewCaseDialog />} />

      <div className="-mt-2 mb-10 grid grid-cols-2 border-y sm:grid-cols-4">
        <Metric
          testId="kpi-pending-approvals"
          index={0}
          label="Awaiting approval"
          value={count((r) => r.status === 'AWAITING_APPROVAL')}
          loading={runs.isPending}
          to="/operator/runs"
          search={{ status: 'AWAITING_APPROVAL' }}
        />
        <Metric
          testId="kpi-runs"
          index={1}
          label="In progress"
          value={count((r) => isRunActive(r.status))}
          loading={runs.isPending}
          to="/operator/runs"
          search={{ status: 'RUNNING' }}
        />
        <Metric
          testId="kpi-flagged"
          index={2}
          label="Flagged cases"
          value={flagged}
          loading={cases.isPending}
          to="/operator/cases"
        />
        <Metric
          testId="kpi-failed"
          index={3}
          label="Failed runs"
          value={count((r) => r.status === 'FAILED')}
          loading={runs.isPending}
          to="/operator/runs"
          search={{ status: 'FAILED' }}
        />
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section
          title="Recent runs"
          aside={
            <Link to="/operator/runs" className="text-text-secondary hover:text-text">
              View all
            </Link>
          }
        >
          {runs.isPending ? (
            <RowsSkeleton rows={6} columns={['w-10', 'w-2/5', 'w-28', 'w-20']} />
          ) : runs.isError ? (
            <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              className="py-2 sm:items-start sm:text-left"
              title="No runs yet"
              description="Create a case, then run an analysis. Results show up here."
            />
          ) : (
            <RunsTable runs={items.slice(0, 8)} compact />
          )}
        </Section>

        <Section title="Needs attention" aside={<span className="text-text-tertiary tabular-nums">{attention.length || ''}</span>}>
          {runs.isPending ? (
            <RowsSkeleton rows={3} columns={['w-2/3', 'w-16']} />
          ) : attention.length === 0 ? (
            <p className="py-2 text-13 text-text-tertiary">Nothing is waiting on you.</p>
          ) : (
            <ul className="divide-y" data-testid="attention-list">
              {attention.map((r) => (
                <li key={r.id} className={cn(rowLinkClass, '-mx-2 rounded-md px-2 py-2.5')}>
                  <div className="flex items-baseline justify-between gap-3">
                    <RowLink
                      to="/operator/runs/$runId"
                      params={{ runId: String(r.id) }}
                      className="min-w-0 truncate text-sm font-medium"
                      title={r.caseTitle}
                    >
                      {r.caseTitle}
                    </RowLink>
                    <span className="shrink-0 text-13 tabular-nums">
                      {formatMoney(r.inputSnapshot.amount, r.inputSnapshot.currency)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-3 text-13 text-text-secondary">
                    <RunStatusBadge status={r.status} testId={`attention-status-${r.id}`} className="text-text-secondary" />
                    <span className="truncate tabular-nums" title={formatDateTime(r.updatedAt)}>
                      {r.output ? `${riskLabel(r.output.riskLevel)} · ` : ''}
                      {formatRelative(r.updatedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  )
}
