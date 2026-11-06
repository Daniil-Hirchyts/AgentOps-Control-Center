import { useNavigate } from '@tanstack/react-router'
import { RiskBadge, RunStatusBadge } from '@/components/shared/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AgentRunDto } from '@/lib/types'
import { formatMoney, formatRelative } from '@/lib/utils'

export function RunsTable({ runs, showCase = true }: { runs: AgentRunDto[]; showCase?: boolean }) {
  const navigate = useNavigate()
  const open = (id: number) => void navigate({ to: '/operator/runs/$runId', params: { runId: String(id) } })
  return (
    <Table data-testid="runs-table">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Run</TableHead>
          {showCase && <TableHead>Case</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Risk</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden lg:table-cell">Model</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r) => (
          <TableRow
            key={r.id}
            tabIndex={0}
            role="link"
            aria-label={`Open run #${r.id}`}
            data-testid={`run-row-${r.id}`}
            className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
            onClick={() => open(r.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') open(r.id)
            }}
          >
            <TableCell className="font-mono text-xs text-muted-foreground">#{r.id}</TableCell>
            {showCase && <TableCell className="max-w-[16rem] truncate font-medium">{r.caseTitle}</TableCell>}
            <TableCell>
              <RunStatusBadge status={r.status} />
            </TableCell>
            <TableCell>{r.output ? <RiskBadge level={r.output.riskLevel} /> : <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(r.inputSnapshot.amount, r.inputSnapshot.currency)}
            </TableCell>
            <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
              {r.modelIdentifier}
              {r.llmMode === 'mock' && <span className="ml-1 rounded bg-muted px-1">mock</span>}
            </TableCell>
            <TableCell className="text-right text-muted-foreground" title={r.createdAt}>
              {formatRelative(r.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
