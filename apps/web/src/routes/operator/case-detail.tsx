import { Link } from '@tanstack/react-router'
import { BackLink, MetaDot, PageHeader, Section } from '@/components/shared/page-header'
import { PageContainer } from '@/components/layout/app-shell'
import { DeviationBar, InvoiceSheet } from '@/components/shared/invoice-visuals'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { CaseStatusBadge } from '@/components/shared/status'
import { Skeleton } from '@/components/ui/skeleton'
import { isRunActive, useRuns } from '@/features/agents/hooks'
import { RunAnalysisDialog } from '@/features/agents/run-analysis-dialog'
import { PipelineTrack } from '@/features/agents/pipeline-track'
import { RunsTable } from '@/features/agents/runs-table'
import { useCase } from '@/features/cases/hooks'
import { predictRisk } from '@/features/cases/schema'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { formatDate, formatRelative } from '@/lib/utils'

export function CaseDetailPage({ caseId }: { caseId: number }) {
  const caseQ = useCase(caseId)
  const runs = useRuns({ caseId })
  useDocumentTitle(caseQ.data?.title ?? 'Case')
  const back = <BackLink to="/operator/cases">Cases</BackLink>

  if (caseQ.isPending) {
    return (
      <PageContainer>
        <div className="mb-8 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-80 max-w-full" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
          </div>
          <RowsSkeleton rows={3} />
        </div>
      </PageContainer>
    )
  }
  if (caseQ.isError) {
    return (
      <PageContainer>
        {back}
        <ErrorState
          error={caseQ.error}
          title={caseQ.error instanceof ApiError && caseQ.error.isNotFound ? 'Case not found' : 'Could not load case'}
          onRetry={() => void caseQ.refetch()}
        />
      </PageContainer>
    )
  }

  const c = caseQ.data
  const activeRun = runs.data?.items.find((r) => isRunActive(r.status) || r.status === 'AWAITING_APPROVAL')
  const latest = runs.data?.items[0]

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={c.title}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CaseStatusBadge status={c.status} />
            <MetaDot />
            <span className="tabular-nums">Case #{c.id}</span>
            <MetaDot />
            <span className="tabular-nums">Opened {formatDate(c.createdAt)}</span>
          </span>
        }
        actions={<RunAnalysisDialog caseId={c.id} />}
      />
      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Section title="Invoice">
          <InvoiceSheet invoice={c.invoice} />
        </Section>
        <div className="min-w-0 space-y-12">
          <Section
            title="Against the vendor’s typical amount"
            aside={<span className="text-text-tertiary">{latest?.output ? `From run #${latest.id}` : 'Preview'}</span>}
          >
            <DeviationBar
              invoice={c.invoice}
              risk={latest?.output?.riskLevel ?? predictRisk(c.invoice.amount, c.invoice.historicalAverage ?? null)}
            />
          </Section>
          <Section
            title="Analyses"
            aside={
              activeRun ? (
                <span className="text-text-secondary">One run is still open</span>
              ) : runs.data ? (
                <span className="text-text-tertiary tabular-nums">{runs.data.items.length}</span>
              ) : null
            }
          >
            {runs.isPending ? (
              <RowsSkeleton rows={3} />
            ) : runs.isError ? (
              <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
            ) : runs.data.items.length === 0 ? (
              <EmptyState
                className="py-2 sm:items-start sm:text-start"
                title="Not analyzed yet"
                description="Run an analysis and choose the reviewer who approves the agent’s recommendation."
              />
            ) : (
              <div className="space-y-6">
                {latest && (
                  <Link
                    to="/operator/runs/$runId"
                    params={{ runId: String(latest.id) }}
                    className="surface block rounded-xl p-4 transition-shadow duration-150 hover:shadow-border-hover"
                    data-testid="case-latest-run"
                  >
                    <span className="mb-3 flex items-baseline justify-between gap-3 text-13">
                      <span className="font-medium text-text">Latest run #{latest.id}</span>
                      <span className="text-text-tertiary tabular-nums">{formatRelative(latest.updatedAt)}</span>
                    </span>
                    <PipelineTrack run={latest} />
                  </Link>
                )}
                <RunsTable runs={runs.data.items} showCase={false} />
              </div>
            )}
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
