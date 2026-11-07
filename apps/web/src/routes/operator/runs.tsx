import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { Dot } from '@/components/shared/status'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRuns } from '@/features/agents/hooks'
import { RunsTable } from '@/features/agents/runs-table'
import { useDocumentTitle } from '@/lib/hooks'
import { RUN_STATUS } from '@/lib/labels'
import { RUN_STATUSES, type RunStatus } from '@/lib/types'

export function RunsPage({
  status,
  onStatusChange,
}: {
  status?: RunStatus
  onStatusChange: (s: RunStatus | undefined) => void
}) {
  useDocumentTitle(status ? `Runs · ${RUN_STATUS[status].label}` : 'Runs')
  const runs = useRuns({ status })
  return (
    <PageContainer>
      <PageHeader
        title="Runs"
        meta={runs.data ? <span className="tabular-nums">{runs.data.total} agent analyses</span> : null}
        actions={
          <div className="w-48">
            <Select value={status ?? 'all'} onValueChange={(v) => onStatusChange(v === 'all' ? undefined : (v as RunStatus))}>
              <SelectTrigger aria-label="Filter by status" data-testid="run-status-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectSeparator />
                {RUN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`run-status-option-${s}`}>
                    <span className="flex items-center gap-2">
                      <Dot tone={RUN_STATUS[s].tone} />
                      {RUN_STATUS[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      {runs.isPending ? (
        <RowsSkeleton rows={6} columns={['w-10', 'w-2/5', 'w-28', 'w-20', 'w-16']} />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.data.items.length === 0 ? (
        <EmptyState
          title={status ? `No runs are ${RUN_STATUS[status].label.toLowerCase()}` : 'No runs yet'}
          description={status ? 'Try another status.' : 'Open a case and run an analysis to see it here.'}
        />
      ) : (
        <RunsTable runs={runs.data.items} />
      )}
    </PageContainer>
  )
}
