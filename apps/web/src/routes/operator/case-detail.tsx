import { BackLink, MetaDot, PageHeader, Section } from '@/components/shared/page-header'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceDetails } from '@/components/shared/invoice-details'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { CaseStatusBadge } from '@/components/shared/status'
import { Skeleton } from '@/components/ui/skeleton'
import { isRunActive, useRuns } from '@/features/agents/hooks'
import { RunAnalysisDialog } from '@/features/agents/run-analysis-dialog'
import { RunsTable } from '@/features/agents/runs-table'
import { useCase } from '@/features/cases/hooks'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { formatDate } from '@/lib/utils'

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
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Section title="Invoice">
          <InvoiceDetails invoice={c.invoice} />
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
              className="py-2 sm:items-start sm:text-left"
              title="Not analyzed yet"
              description="Run an analysis and choose the reviewer who approves the agent’s recommendation."
            />
          ) : (
            <RunsTable runs={runs.data.items} showCase={false} />
          )}
        </Section>
      </div>
    </PageContainer>
  )
}
