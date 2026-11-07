import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { RowLink, rowLinkClass } from '@/components/shared/row-link'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { DeviationMini } from '@/components/shared/invoice-visuals'
import { CaseStatusBadge } from '@/components/shared/status'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCases } from '@/features/cases/hooks'
import { NewCaseDialog } from '@/features/cases/new-case-dialog'
import { useDocumentTitle } from '@/lib/hooks'
import { formatDateTime, formatMoney, formatRelative } from '@/lib/utils'

export function CasesPage() {
  useDocumentTitle('Cases')
  const cases = useCases()
  const items = [...(cases.data?.items ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <PageContainer>
      <PageHeader
        title="Cases"
        meta={cases.data ? <span className="tabular-nums">{cases.data.total} invoices under investigation</span> : null}
        actions={<NewCaseDialog />}
      />
      {cases.isPending ? (
        <RowsSkeleton rows={6} columns={['w-2/5', 'w-1/5', 'w-24', 'w-20', 'w-20', 'w-16']} />
      ) : cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No cases yet" description="Create a case for an invoice you want the agent to assess." />
      ) : (
        <Table data-testid="cases-table">
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden xl:table-cell">Vendor</TableHead>
              <TableHead className="hidden 2xl:table-cell">Invoice</TableHead>
              <TableHead className="text-end">Amount</TableHead>
              <TableHead className="hidden md:table-cell">Vs typical</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-end sm:table-cell">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id} className={rowLinkClass} data-testid={`case-row-${c.id}`}>
                <TableCell className="max-w-[14rem] truncate font-medium sm:max-w-[20rem]">
                  <RowLink to="/operator/cases/$caseId" params={{ caseId: String(c.id) }} title={c.title}>
                    {c.title}
                  </RowLink>
                </TableCell>
                <TableCell className="hidden max-w-[12rem] truncate text-text-secondary xl:table-cell" title={c.invoice.vendor}>
                  {c.invoice.vendor}
                </TableCell>
                <TableCell className="hidden font-mono text-13 text-text-secondary 2xl:table-cell">{c.invoice.invoiceNumber}</TableCell>
                <TableCell className="text-end tabular-nums">{formatMoney(c.invoice.amount, c.invoice.currency)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <DeviationMini invoice={c.invoice} />
                </TableCell>
                <TableCell>
                  <CaseStatusBadge status={c.status} />
                </TableCell>
                <TableCell
                  className="hidden text-end text-13 text-text-secondary tabular-nums sm:table-cell"
                  title={formatDateTime(c.createdAt)}
                >
                  {formatRelative(c.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  )
}
