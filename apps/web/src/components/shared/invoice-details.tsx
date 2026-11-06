import { TrendingUp } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import type { InvoiceInput } from '@/lib/types'

export function InvoiceDetails({ invoice }: { invoice: InvoiceInput }) {
  const avg = invoice.historicalAverage
  const ratio = avg && avg > 0 ? invoice.amount / avg : null
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <Item label="Invoice #" value={<span className="font-mono">{invoice.invoiceNumber}</span>} />
      <Item label="Vendor" value={invoice.vendor} />
      <Item
        label="Amount"
        value={<span className="text-base font-semibold">{formatMoney(invoice.amount, invoice.currency)}</span>}
      />
      <Item label="Issue date" value={invoice.issueDate} />
      <Item
        label="Historical average"
        value={
          avg != null ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatMoney(avg, invoice.currency)}
              {ratio !== null && ratio >= 1.5 && (
                <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  <TrendingUp className="size-3" /> {ratio.toFixed(1)}× average
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Not provided</span>
          )
        }
      />
      <Item label="Currency" value={invoice.currency} />
      <div className="sm:col-span-2">
        <dt className="text-xs font-medium text-muted-foreground">Description</dt>
        <dd className="mt-1 whitespace-pre-wrap">{invoice.description || '—'}</dd>
      </div>
    </dl>
  )
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  )
}
