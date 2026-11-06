import { Link } from '@tanstack/react-router'
import { ArrowLeft, PlayCircle } from 'lucide-react'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceDetails } from '@/components/shared/invoice-details'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { CaseStatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isRunActive, useRuns } from '@/features/agents/hooks'
import { RunAnalysisDialog } from '@/features/agents/run-analysis-dialog'
import { RunsTable } from '@/features/agents/runs-table'
import { useCase } from '@/features/cases/hooks'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

export function CaseDetailPage({ caseId }: { caseId: number }) {
  const caseQ = useCase(caseId)
  const runs = useRuns({ caseId })
  const back = (
    <Link to="/operator/cases" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" /> Cases
    </Link>
  )

  if (caseQ.isPending) {
    return (
      <PageContainer>
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    )
  }
  if (caseQ.isError) {
    return (
      <PageContainer>
        {back}
        <ErrorState
          className="mt-4"
          error={caseQ.error}
          title={caseQ.error instanceof ApiError && caseQ.error.isNotFound ? 'Case not found' : 'Could not load case'}
          onRetry={() => void caseQ.refetch()}
        />
      </PageContainer>
    )
  }

  const c = caseQ.data
  const hasActiveRun = runs.data?.items.some((r) => isRunActive(r.status) || r.status === 'AWAITING_APPROVAL') ?? false

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CaseStatusBadge status={c.status} />
            <span>Case #{c.id}</span>·<span>Opened {formatDateTime(c.createdAt)}</span>
          </span>
        }
        actions={<RunAnalysisDialog caseId={c.id} />}
      />
      {hasActiveRun && (
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          A run for this case is still in progress — you can still start another analysis.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Invoice</CardTitle>
              <CardDescription>Data submitted to the AI agent</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <InvoiceDetails invoice={c.invoice} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Run history</CardTitle>
              <CardDescription>Every AI analysis performed on this case</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-3">
            {runs.isPending ? (
              <ListSkeleton rows={3} />
            ) : runs.isError ? (
              <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
            ) : runs.data.items.length === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No analysis yet"
                description="Run the AI analysis and pick a reviewer to approve its recommendation."
              />
            ) : (
              <RunsTable runs={runs.data.items} showCase={false} />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
