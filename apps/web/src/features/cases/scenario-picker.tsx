/**
 * New-case helpers: scenario cards that fill the form, and a live preview of what the
 * agent will likely make of the numbers typed so far.
 */
import type { ReactNode } from 'react'
import { DeviationBar, RiskGauge } from '@/components/shared/invoice-visuals'
import type { RiskLevel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { predictRisk, type Scenario, SCENARIOS, type ScenarioId } from './schema'

const BAR: Record<RiskLevel, string> = {
  low: 'bg-success-solid',
  medium: 'bg-warning-solid',
  high: 'bg-danger-solid',
}

export function ScenarioPicker({
  value,
  onPick,
  aside,
}: {
  value: ScenarioId | null
  onPick: (s: Scenario) => void
  aside?: ReactNode
}) {
  return (
    <fieldset className="space-y-2">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <legend className="text-sm font-medium text-text">Start from a scenario</legend>
        {aside}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SCENARIOS.map((s) => {
          const selected = value === s.id
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(s)}
              data-testid={`scenario-${s.id}`}
              className={cn(
                'pressable group flex min-w-0 flex-col justify-start gap-2.5 rounded-xl p-3 text-start outline-none',
                'shadow-border transition-[box-shadow,background-color,transform] duration-150 hover:shadow-border-hover',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                selected ? 'bg-accent-subtle ring-2 ring-accent-solid' : 'bg-bg-surface',
              )}
            >
              <ScenarioGlyph scenario={s} />
              <span className="min-w-0">
                <span className="block truncate text-13 font-medium text-text">{s.label}</span>
                <span className="line-clamp-2 block text-xs text-text-tertiary">{s.blurb}</span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Two bars: the vendor's typical amount and this invoice, on the same scale. */
function ScenarioGlyph({ scenario }: { scenario: Scenario }) {
  const amount = Number(scenario.values.amount)
  const avg = scenario.values.historicalAverage ? Number(scenario.values.historicalAverage) : null
  const risk = predictRisk(amount, avg) ?? 'low'
  const max = Math.max(amount, avg ?? 0)
  const w = (v: number) => `${Math.max(6, (v / max) * 100)}%`
  return (
    <span className="flex w-full flex-col gap-1" aria-hidden>
      {avg ? (
        <span className="h-1.5 rounded-full bg-bg-active" style={{ width: w(avg) }} />
      ) : (
        <span className="h-1.5 w-1/3 rounded-full border border-dashed border-border-strong" />
      )}
      <span className={cn('h-1.5 rounded-full', BAR[risk])} style={{ width: avg ? w(amount) : '100%' }} />
    </span>
  )
}

export function CasePreview({
  amount,
  currency,
  historicalAverage,
}: {
  amount: string
  currency: string
  historicalAverage: string
}) {
  const a = Number(amount)
  const avg = historicalAverage.trim() && Number(historicalAverage) > 0 ? Number(historicalAverage) : null
  const risk = Number.isFinite(a) ? predictRisk(a, avg) : null
  if (!risk) {
    return (
      <p className="rounded-xl bg-bg-subtle px-4 py-3 text-13 text-text-tertiary" data-testid="case-preview">
        Enter an amount to preview how the agent will likely judge it.
      </p>
    )
  }
  return (
    <section
      className="grid items-center gap-x-6 gap-y-3 rounded-xl bg-bg-subtle px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)]"
      aria-label="Agent preview"
      data-testid="case-preview"
      data-risk={risk}
    >
      <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1">
        <RiskGauge level={risk} size={76} />
      </div>
      <DeviationBar
        invoice={{
          amount: a,
          currency: /^[A-Z]{3}$/.test(currency) ? currency : 'EUR',
          historicalAverage: avg,
          invoiceNumber: '',
          vendor: '',
          issueDate: '',
          description: '',
        }}
        risk={risk}
      />
    </section>
  )
}
