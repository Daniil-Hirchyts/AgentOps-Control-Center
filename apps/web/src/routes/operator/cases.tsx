import { useNavigate } from '@tanstack/react-router'
import { FileSearch } from 'lucide-react'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { CaseStatusBadge } from '@/components/shared/status-badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCases } from '@/features/cases/hooks'
import { NewCaseDialog } from '@/features/cases/new-case-dialog'
import { formatMoney, formatRelative } from '@/lib/utils'

export function CasesPage() {
  const cases = useCases()
  const navigate = useNavigate()
  const items = [...(cases.data?.items ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const open = (id: number) => void navigate({ to: '/operator/cases/$caseId', params: { caseId: String(id) } })

  return (
    <PageContainer>
      <PageHeader
        title="Cases"
        description="Invoice investigations you have opened."
        actions={<NewCaseDialog />}
      />
      {cases.isPending ? (
        <ListSkeleton rows={6} />
      ) : cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No investigations yet"
          description="Create your first investigation to let the AI agent assess an invoice."
          action={<NewCaseDialog />}
        />
      ) : (
        <Card className="py-1">
          <Table data-testid="cases-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="hidden sm:table-cell">Invoice #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow
                  key={c.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open case ${c.title}`}
                  data-testid={`case-row-${c.id}`}
                  className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => open(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open(c.id)
                  }}
                >
                  <TableCell className="max-w-[18rem] truncate font-medium">{c.title}</TableCell>
                  <TableCell className="max-w-[12rem] truncate">{c.invoice.vendor}</TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{c.invoice.invoiceNumber}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(c.invoice.amount, c.invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <CaseStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatRelative(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  )
}
