import type { ReactNode } from 'react'
import type { InvoiceInput } from '@/lib/types'
import { cn, deviation, formatDate, formatMoney } from '@/lib/utils'

export function InvoiceDetails({ invoice, className }: { invoice: InvoiceInput; className?: string }) {
  const avg = invoice.historicalAverage
  const ratio = deviation(invoice)
  return (
    <dl className={cn('grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-2.5 text-sm', className)}>
      <Item label="Amount">
        <span className="font-medium tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</span>
      </Item>
      <Item label="Historical average">
        {avg != null ? (
          <span className="tabular-nums">
            {formatMoney(avg, invoice.currency)}
            {ratio !== null && (
              <span className={cn('ml-2 text-13', ratio >= 1.5 ? 'text-danger' : 'text-text-tertiary')}>
                {ratio.toFixed(1)}× average
              </span>
            )}
          </span>
        ) : (
          <span className="text-text-tertiary">Not provided</span>
        )}
      </Item>
      <Item label="Vendor">{invoice.vendor}</Item>
      <Item label="Invoice number">
        <span className="font-mono text-13">{invoice.invoiceNumber}</span>
      </Item>
      <Item label="Issue date">
        <span className="tabular-nums">{formatDate(invoice.issueDate)}</span>
      </Item>
      <Item label="Description">
        {invoice.description ? (
          <span className="whitespace-pre-wrap">{invoice.description}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </Item>
    </dl>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </>
  )
}
