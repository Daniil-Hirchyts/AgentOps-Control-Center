import { Link } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { Dot } from '@/components/shared/status'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRuns } from '@/features/agents/hooks'
import { useAuditEvents } from '@/features/audit/hooks'
import { auditSummary } from '@/features/audit/summary'
import { useDocumentTitle } from '@/lib/hooks'
import { AUDIT_EVENT_TONE, auditEventLabel } from '@/lib/labels'
import { formatDateTime } from '@/lib/utils'

export function AuditPage({
  agentRunId,
  onRunChange,
}: {
  agentRunId?: number
  onRunChange: (id: number | undefined) => void
}) {
  useDocumentTitle(agentRunId ? `Audit log · Run #${agentRunId}` : 'Audit log')
  const audit = useAuditEvents({ agentRunId })
  const runs = useRuns()
  const events = [...(audit.data?.items ?? [])].reverse()

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        meta="Append-only record of every agent step and human decision."
        actions={
          <div className="w-64 max-w-full">
            <Select
              value={agentRunId ? String(agentRunId) : 'all'}
              onValueChange={(v) => onRunChange(v === 'all' ? undefined : Number(v))}
            >
              <SelectTrigger aria-label="Filter by run" data-testid="audit-run-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All runs</SelectItem>
                <SelectSeparator />
                {(runs.data?.items ?? []).map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    <span className="font-mono text-text-tertiary tabular-nums">#{r.id}</span> {r.caseTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      {audit.isPending ? (
        <RowsSkeleton rows={10} columns={['w-28', 'w-36', 'w-10', 'w-16', 'w-1/3']} />
      ) : audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState title="No events yet" description="Events are recorded as soon as a run starts." />
      ) : (
        <Table data-testid="audit-table">
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Run</TableHead>
              <TableHead className="hidden sm:table-cell">Actor</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => {
              const summary = auditSummary(e)
              return (
                <TableRow key={e.id} data-testid="audit-row">
                  <TableCell className="text-13 text-text-secondary tabular-nums">{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Dot tone={AUDIT_EVENT_TONE[e.eventType] ?? 'neutral'} className="size-1.5" />
                      {auditEventLabel(e.eventType)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {e.agentRunId ? (
                      <Link
                        to="/operator/runs/$runId"
                        params={{ runId: String(e.agentRunId) }}
                        className="font-mono text-13 text-accent-text tabular-nums hover:underline"
                      >
                        #{e.agentRunId}
                      </Link>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-text-secondary sm:table-cell">{e.actorUsername ?? 'System'}</TableCell>
                  <TableCell
                    className="hidden max-w-md truncate text-13 text-text-secondary md:table-cell"
                    title={summary ?? JSON.stringify(e.payload)}
                  >
                    {summary ?? <span className="font-mono text-xs text-text-tertiary">{JSON.stringify(e.payload)}</span>}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  )
}
