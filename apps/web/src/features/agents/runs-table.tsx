import { RowLink, rowLinkClass } from '@/components/shared/row-link'
import { RiskBadge, RunStatusBadge } from '@/components/shared/status'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AgentRunDto } from '@/lib/types'
import { PipelineTrack } from './pipeline-track'
import { cn, formatDateTime, formatMoney, formatRelative } from '@/lib/utils'

/** `compact` drops the risk column (used where the table shares the row with another section). */
export function RunsTable({
  runs,
  showCase = true,
  compact = false,
}: {
  runs: AgentRunDto[]
  showCase?: boolean
  compact?: boolean
}) {
  const riskCell = compact ? 'hidden' : 'hidden md:table-cell'
  return (
    <Table data-testid="runs-table">
      <TableHeader>
        <TableRow>
          <TableHead className={cn('w-16', showCase && 'hidden sm:table-cell')}>Run</TableHead>
          {showCase && <TableHead>Case</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Pipeline</TableHead>
          <TableHead className={riskCell}>Risk</TableHead>
          <TableHead className="hidden text-end sm:table-cell">Amount</TableHead>
          <TableHead className="hidden text-end sm:table-cell">Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r) => (
          <TableRow key={r.id} className={rowLinkClass} data-testid={`run-row-${r.id}`}>
            <TableCell className={cn('font-mono text-13 text-text-tertiary tabular-nums', showCase && 'hidden sm:table-cell')}>
              {showCase ? (
                `#${r.id}`
              ) : (
                <RowLink to="/operator/runs/$runId" params={{ runId: String(r.id) }} className="text-text">
                  #{r.id}
                </RowLink>
              )}
            </TableCell>
            {showCase && (
              <TableCell className="max-w-[11rem] truncate font-medium sm:max-w-[18rem]">
                <RowLink to="/operator/runs/$runId" params={{ runId: String(r.id) }} title={r.caseTitle}>
                  {r.caseTitle}
                </RowLink>
              </TableCell>
            )}
            <TableCell>
              <RunStatusBadge status={r.status} testId={`run-row-status-${r.id}`} />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <PipelineTrack run={r} compact />
            </TableCell>
            <TableCell className={riskCell}>
              {r.output ? <RiskBadge level={r.output.riskLevel} /> : <span className="text-text-tertiary">—</span>}
            </TableCell>
            <TableCell className="hidden text-end tabular-nums sm:table-cell">
              {formatMoney(r.inputSnapshot.amount, r.inputSnapshot.currency)}
            </TableCell>
            <TableCell className="hidden text-end text-13 text-text-secondary tabular-nums sm:table-cell" title={formatDateTime(r.createdAt)}>
              {formatRelative(r.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
