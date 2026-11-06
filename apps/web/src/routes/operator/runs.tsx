import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { NativeSelect } from '@/components/ui/native-select'
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
            <NativeSelect
              aria-label="Filter by status"
              data-testid="run-status-filter"
              value={status ?? ''}
              onChange={(e) => onStatusChange((e.target.value || undefined) as RunStatus | undefined)}
            >
              <option value="">All statuses</option>
              {RUN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RUN_STATUS[s].label}
                </option>
              ))}
            </NativeSelect>
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
