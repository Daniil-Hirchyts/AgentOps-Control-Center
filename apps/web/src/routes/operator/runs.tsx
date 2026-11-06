import { PlayCircle } from 'lucide-react'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { RUN_STATUS_META } from '@/components/shared/status-meta'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { useRuns } from '@/features/agents/hooks'
import { RunsTable } from '@/features/agents/runs-table'
import { RUN_STATUSES, type RunStatus } from '@/lib/types'
import { humanize } from '@/lib/utils'

export function RunsPage({
  status,
  onStatusChange,
}: {
  status?: RunStatus
  onStatusChange: (s: RunStatus | undefined) => void
}) {
  const runs = useRuns({ status })
  return (
    <PageContainer>
      <PageHeader
        title="Agent runs"
        description="Every AI analysis you launched and where it stands."
        actions={
          <div className="w-52">
            <NativeSelect
              aria-label="Filter by status"
              data-testid="run-status-filter"
              value={status ?? ''}
              onChange={(e) => onStatusChange((e.target.value || undefined) as RunStatus | undefined)}
            >
              <option value="">All statuses</option>
              {RUN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RUN_STATUS_META[s].label ?? humanize(s)}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
      />
      {runs.isPending ? (
        <ListSkeleton rows={6} />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.data.items.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title={status ? 'No runs with this status' : 'No runs yet'}
          description={status ? 'Try another filter.' : 'Open a case and click “Run AI analysis”.'}
        />
      ) : (
        <Card className="py-1">
          <RunsTable runs={runs.data.items} />
        </Card>
      )}
    </PageContainer>
  )
}
