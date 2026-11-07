/**
 * Invoice visuals: the agent's evidence drawn, not listed.
 *
 *  - DeviationBar: this amount against the vendor's typical amount, on one scale, with the
 *    agent's 3× threshold marked — the single comparison the risk decision turns on.
 *  - RiskGauge: low / medium / high as a three-band dial with the needle at the result.
 *  - InvoiceSheet: the invoice as a document, so a reviewer recognises what they approve.
 *
 * Every visual carries its value as text too; colour is never the only signal.
 */
import type { InvoiceInput, RiskLevel } from '@/lib/types'
import { RISK } from '@/lib/labels'
import { cn, deviation, formatDate, formatMoney } from '@/lib/utils'

/** Mirrors the mock analyst's rule (backend/src/llm/mock.rs): > 3× typical is high risk. */
export const HIGH_RATIO = 3

const RISK_FILL: Record<RiskLevel, string> = {
  low: 'bg-success-solid',
  medium: 'bg-warning-solid',
  high: 'bg-danger-solid',
}

export function DeviationBar({
  invoice,
  risk,
  className,
}: {
  invoice: InvoiceInput
  risk?: RiskLevel | null
  className?: string
}) {
  const ratio = deviation(invoice)
  const avg = invoice.historicalAverage
  if (avg == null || ratio === null) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <p className="text-2xl font-semibold tracking-[-0.015em] tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</p>
        <p className="text-13 text-text-tertiary">No typical amount on file for this vendor, so the agent judged the amount alone.</p>
      </div>
    )
  }
  const max = Math.max(invoice.amount, avg * HIGH_RATIO) * 1.08
  const num = (v: number) => Math.min(100, (v / max) * 100)
  const pct = (v: number) => `${num(v)}%`
  const over = ratio > HIGH_RATIO
  const fill = risk ? RISK_FILL[risk] : over ? 'bg-danger-solid' : 'bg-accent-solid'
  return (
    <figure className={cn('space-y-3', className)} data-testid="deviation-bar">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-2xl font-semibold tracking-[-0.015em] tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</p>
        <p className={cn('text-sm font-medium tabular-nums', over ? 'text-danger-text' : 'text-text-secondary')}>
          {ratio.toFixed(1)}× typical
        </p>
      </div>
      <div className="relative pt-5 pb-6" aria-hidden>
        {/* track */}
        <div className="relative h-2.5 rounded-full bg-bg-muted">
          <div className="absolute inset-y-0 start-0 rounded-full bg-bg-active" style={{ width: pct(avg) }} />
          <div className={cn('absolute inset-y-0 start-0 rounded-full opacity-90', fill)} style={{ width: pct(invoice.amount) }} />
        </div>
        {/* typical marker */}
        <Marker at={num(avg)} label="Typical" value={formatMoney(avg, invoice.currency)} side="below" />
        {/* threshold marker */}
        <Marker at={num(avg * HIGH_RATIO)} label={`${HIGH_RATIO}× limit`} side="above" dashed />
      </div>
      <figcaption className="sr-only">
        {formatMoney(invoice.amount, invoice.currency)} is {ratio.toFixed(1)} times the typical {formatMoney(avg, invoice.currency)}; the
        agent treats more than {HIGH_RATIO} times as high risk.
      </figcaption>
    </figure>
  )
}

/** Table-sized deviation: a short track with the typical tick and the 3× limit, plus the ratio. */
export function DeviationMini({ invoice, className }: { invoice: Pick<InvoiceInput, 'amount' | 'historicalAverage'>; className?: string }) {
  const ratio = deviation(invoice)
  if (ratio === null) return <span className={cn('text-13 text-text-tertiary', className)}>No history</span>
  const scale = Math.max(ratio, HIGH_RATIO) * 1.1
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
  const over = ratio > HIGH_RATIO
  return (
    <span className={cn('inline-flex items-center gap-2', className)} data-testid="deviation-mini">
      <span className="relative h-1.5 w-16 rounded-full bg-bg-muted" aria-hidden>
        <span className={cn('absolute inset-y-0 start-0 rounded-full', over ? 'bg-danger-solid' : 'bg-accent-solid')} style={{ width: pct(ratio) }} />
        <span className="absolute -inset-y-0.5 w-px bg-text-secondary" style={{ insetInlineStart: pct(1) }} />
        <span className="absolute -inset-y-0.5 border-s border-dashed border-text-tertiary" style={{ insetInlineStart: pct(HIGH_RATIO) }} />
      </span>
      <span className={cn('min-w-10 text-end text-13 tabular-nums', over ? 'font-medium text-danger-text' : 'text-text-secondary')}>
        {ratio.toFixed(1)}×<span className="sr-only"> the vendor’s typical amount</span>
      </span>
    </span>
  )
}

function Marker({ at, label, value, side, dashed }: { at: number; label: string; value?: string; side: 'above' | 'below'; dashed?: boolean }) {
  return (
    <div className="absolute inset-y-0" style={{ insetInlineStart: `${at}%` }}>
      <div
        className={cn(
          'absolute top-3.5 bottom-4.5 -translate-x-1/2 border-s',
          dashed ? 'border-dashed border-text-tertiary' : 'border-text-secondary',
        )}
      />
      <span
        className={cn(
          'absolute text-xs whitespace-nowrap text-text-tertiary tabular-nums',
          // keep edge labels inside the track instead of centring them past it
          at < 15 ? '-start-px' : at > 85 ? '-end-px' : '-translate-x-1/2 rtl:translate-x-1/2',
          side === 'above' ? 'top-0' : 'bottom-0',
        )}
      >
        {label}
        {value && <span className="text-text-secondary"> {value}</span>}
      </span>
    </div>
  )
}

/** Half-dial: three bands, needle at the band's middle. */
export function RiskGauge({ level, className, size = 112 }: { level: RiskLevel; className?: string; size?: number }) {
  const angle = { low: -60, medium: 0, high: 60 }[level]
  const band = (from: number, to: number) => {
    const r = 40
    const a0 = ((from - 90) * Math.PI) / 180
    const a1 = ((to - 90) * Math.PI) / 180
    return `M ${50 + r * Math.cos(a0)} ${50 + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)}`
  }
  const active = (l: RiskLevel) => (l === level ? 1 : 0.28)
  return (
    <figure className={cn('inline-flex flex-col items-center', className)} data-testid="risk-gauge" data-level={level}>
      <svg viewBox="0 4 100 52" width={size} height={size * 0.52} aria-hidden className="overflow-visible">
        <path d={band(-88, -32)} className="stroke-success-solid" strokeWidth={9} fill="none" strokeLinecap="round" opacity={active('low')} />
        <path d={band(-28, 28)} className="stroke-warning-solid" strokeWidth={9} fill="none" strokeLinecap="round" opacity={active('medium')} />
        <path d={band(32, 88)} className="stroke-danger-solid" strokeWidth={9} fill="none" strokeLinecap="round" opacity={active('high')} />
        <g
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: '50px 50px', transition: 'transform 500ms var(--ease-out)' }}
          data-motion="transform"
        >
          <line x1="50" y1="50" x2="50" y2="20" className="stroke-text" strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="4.5" className="fill-text" />
        <circle cx="50" cy="50" r="1.6" className="fill-bg-surface" />
      </svg>
      <figcaption className="mt-1 text-13 font-medium">{RISK[level].label}</figcaption>
    </figure>
  )
}

/** The invoice as a paper document. */
export function InvoiceSheet({ invoice, className }: { invoice: InvoiceInput; className?: string }) {
  return (
    <article
      className={cn('surface relative overflow-hidden rounded-lg', className)}
      aria-label={`Invoice ${invoice.invoiceNumber} from ${invoice.vendor}`}
      data-testid="invoice-sheet"
    >
      <div className="h-1 bg-accent-solid" aria-hidden />
      <div className="space-y-5 p-5">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs text-text-tertiary">From</p>
            <p className="truncate text-sm font-semibold">{invoice.vendor}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-text-tertiary">Invoice</dt>
            <dd className="text-end font-mono text-text">{invoice.invoiceNumber}</dd>
            <dt className="text-text-tertiary">Issued</dt>
            <dd className="text-end text-text tabular-nums">{formatDate(invoice.issueDate)}</dd>
          </dl>
        </header>
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-separator pb-2 text-xs text-text-tertiary">
            <span>Description</span>
            <span className="text-end">Amount</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 text-sm">
            <p className="whitespace-pre-wrap text-text">{invoice.description || '—'}</p>
            <p className="text-end tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</p>
          </div>
        </div>
        <footer className="flex items-baseline justify-between gap-4 border-t border-separator pt-3">
          <span className="text-13 text-text-secondary">Total due</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</span>
        </footer>
      </div>
    </article>
  )
}
