import { Link } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader, Section } from '@/components/shared/page-header'
import { RowLink, rowLinkClass } from '@/components/shared/row-link'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { RunStatusBadge } from '@/components/shared/status'
import { useRuns } from '@/features/agents/hooks'
import { PipelineBoard } from '@/features/agents/pipeline-board'
import { PipelineTrack } from '@/features/agents/pipeline-track'
import { RunsTable } from '@/features/agents/runs-table'
import { NewCaseDialog } from '@/features/cases/new-case-dialog'
import { useDocumentTitle } from '@/lib/hooks'
import type { AgentRunDto, RiskLevel } from '@/lib/types'
import { cn, formatDateTime, formatMoney, formatRelative } from '@/lib/utils'

export function OperatorDashboard() {
  useDocumentTitle('Overview')
  const runs = useRuns()

  const items = runs.data?.items ?? []
  const awaiting = items.filter((r) => r.status === 'AWAITING_APPROVAL')
  const failed = items.filter((r) => r.status === 'FAILED')
  const attention = [...awaiting, ...failed].slice(0, 6)

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader title="Overview" actions={<NewCaseDialog />} />

      {runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : (
        <PipelineBoard runs={items} loading={runs.isPending} />
      )}

      <div className="mt-12 grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
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
          ) : items.length === 0 ? (
            <EmptyState
              className="py-2 sm:items-start sm:text-start"
              title="No runs yet"
              description="Create a case, then run an analysis. Results show up here."
            />
          ) : (
            <RunsTable runs={items.slice(0, 8)} compact />
          )}
        </Section>

        <div className="min-w-0 space-y-12">
          <Section title="Needs attention" aside={<span className="text-text-tertiary tabular-nums">{attention.length || ''}</span>}>
            {runs.isPending ? (
              <RowsSkeleton rows={3} columns={['w-2/3', 'w-16']} />
            ) : attention.length === 0 ? (
              <p className="py-2 text-13 text-text-tertiary">Nothing is waiting on you.</p>
            ) : (
              <ul className="space-y-1" data-testid="attention-list">
                {attention.map((r) => (
                  <li key={r.id} className={cn(rowLinkClass, '-mx-2 rounded-lg px-2 py-2.5')}>
                    <div className="flex items-baseline justify-between gap-3">
                      <RowLink
                        to="/operator/runs/$runId"
                        params={{ runId: String(r.id) }}
                        className="min-w-0 truncate text-sm font-medium"
                        title={r.caseTitle}
                      >
                        {r.caseTitle}
                      </RowLink>
                      <span className="shrink-0 text-13 tabular-nums">{formatMoney(r.inputSnapshot.amount, r.inputSnapshot.currency)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-13 text-text-secondary">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <PipelineTrack run={r} compact />
                        <RunStatusBadge status={r.status} testId={`attention-status-${r.id}`} className="text-text-secondary" />
                      </span>
                      <span className="shrink-0 tabular-nums" title={formatDateTime(r.updatedAt)}>
                        {formatRelative(r.updatedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {!runs.isPending && items.length > 0 && (
            <Section title="What the agent found">
              <RiskMix runs={items} />
            </Section>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

const MIX: { level: RiskLevel; label: string; bar: string }[] = [
  { level: 'high', label: 'High', bar: 'bg-danger-solid' },
  { level: 'medium', label: 'Medium', bar: 'bg-warning-solid' },
  { level: 'low', label: 'Low', bar: 'bg-success-solid' },
]

/** Share of analyzed runs per risk level, and how much money waits behind the gate. */
function RiskMix({ runs }: { runs: AgentRunDto[] }) {
  const analyzed = runs.filter((r) => r.output)
  const total = analyzed.length
  const atStake = runs
    .filter((r) => r.status === 'AWAITING_APPROVAL')
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.inputSnapshot.currency] = (acc[r.inputSnapshot.currency] ?? 0) + r.inputSnapshot.amount
      return acc
    }, {})
  const stakeText = Object.entries(atStake)
    .map(([cur, sum]) => formatMoney(sum, cur))
    .join(' + ')

  if (total === 0) return <p className="text-13 text-text-tertiary">No finished analyses yet.</p>
  return (
    <div className="space-y-4" data-testid="risk-mix">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={MIX.map((m) => `${m.label}: ${analyzed.filter((r) => r.output!.riskLevel === m.level).length}`).join(', ')}>
        {MIX.map((m) => {
          const n = analyzed.filter((r) => r.output!.riskLevel === m.level).length
          return n > 0 ? <span key={m.level} className={m.bar} style={{ flexGrow: n }} /> : null
        })}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-13">
        {MIX.map((m) => (
          <div key={m.level}>
            <dt className="flex items-center gap-1.5 text-text-secondary">
              <span className={cn('size-1.5 rounded-full', m.bar)} aria-hidden />
              {m.label}
            </dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums">{analyzed.filter((r) => r.output!.riskLevel === m.level).length}</dd>
          </div>
        ))}
      </dl>
      {stakeText && (
        <p className="text-13 text-text-secondary">
          <span className="font-medium text-text tabular-nums">{stakeText}</span> waits behind the review gate.
        </p>
      )}
    </div>
  )
}
