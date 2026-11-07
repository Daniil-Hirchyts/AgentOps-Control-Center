import { RowLink, rowLinkClass } from '@/components/shared/row-link'
import { MobileList, MobileListItem } from '@/components/shared/mobile-list'
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
  // In the compact table the start time only fits on wide screens; the stacked rows on phones keep it.
  const startedCell = compact ? 'hidden 2xl:table-cell' : 'hidden sm:table-cell'
  return (
    <>
    <MobileList data-testid="runs-list">
      {runs.map((r) => (
        <MobileListItem
          key={r.id}
          data-testid={`run-item-${r.id}`}
          title={
            <RowLink to="/operator/runs/$runId" params={{ runId: String(r.id) }}>
              {showCase ? r.caseTitle : `Run #${r.id}`}
            </RowLink>
          }
          trailing={formatMoney(r.inputSnapshot.amount, r.inputSnapshot.currency)}
          meta={
            <>
              <RunStatusBadge status={r.status} testId={`run-item-status-${r.id}`} />
              {!compact && r.output && <RiskBadge level={r.output.riskLevel} />}
              <span className="ms-auto shrink-0 tabular-nums">
                {showCase && <span className="font-mono text-text-tertiary">#{r.id} · </span>}
                {formatRelative(r.createdAt)}
              </span>
            </>
          }
        />
      ))}
    </MobileList>
    <Table data-testid="runs-table" containerClassName="hidden sm:block">
      <TableHeader>
        <TableRow>
          <TableHead className={cn('w-16', showCase && 'hidden sm:table-cell')}>Run</TableHead>
          {showCase && <TableHead>Case</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Pipeline</TableHead>
          <TableHead className={riskCell}>Risk</TableHead>
          <TableHead className="hidden text-end sm:table-cell">Amount</TableHead>
          <TableHead className={cn('text-end', startedCell)}>Started</TableHead>
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
            <TableCell className={cn('text-end text-13 text-text-secondary tabular-nums', startedCell)} title={formatDateTime(r.createdAt)}>
              {formatRelative(r.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  )
}
