import { Link } from '@tanstack/react-router'
import { ScrollText } from 'lucide-react'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRuns } from '@/features/agents/hooks'
import { auditSummary } from '@/features/audit/summary'
import { useAuditEvents } from '@/features/audit/hooks'
import { formatDateTime, humanize } from '@/lib/utils'

export function AuditPage({
  agentRunId,
  onRunChange,
}: {
  agentRunId?: number
  onRunChange: (id: number | undefined) => void
}) {
  const audit = useAuditEvents({ agentRunId })
  const runs = useRuns()
  const events = [...(audit.data?.items ?? [])].reverse()

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Immutable trail of every agent step, LLM call and human decision."
        actions={
          <div className="w-64">
            <NativeSelect
              aria-label="Filter by run"
              data-testid="audit-run-filter"
              value={agentRunId ?? ''}
              onChange={(e) => onRunChange(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All runs</option>
              {(runs.data?.items ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {r.caseTitle}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
      />
      {audit.isPending ? (
        <ListSkeleton rows={8} />
      ) : audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit events" description="Events appear as soon as a run starts." />
      ) : (
        <Card className="py-1">
          <Table data-testid="audit-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} data-testid="audit-row">
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell className="font-medium">{humanize(e.eventType)}</TableCell>
                  <TableCell>
                    {e.agentRunId ? (
                      <Link
                        to="/operator/runs/$runId"
                        params={{ runId: String(e.agentRunId) }}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        #{e.agentRunId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{e.actorUsername ?? <span className="text-muted-foreground">system</span>}</TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(e.payload)}>
                    {auditSummary(e) ?? JSON.stringify(e.payload)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  )
}
