/**
 * Pipeline board — every run placed on the same five stages the run page shows, so the
 * overview reads as one machine with work moving through it. Each lane: stage node on a
 * shared rail, a live count, and the newest runs sitting in it. Runs that left the line
 * (failed, rejected, cancelled) drop to an off-ramp underneath instead of a sixth lane.
 */
import { Link } from '@tanstack/react-router'
import { Archive, Ban, Inbox, KeyRound, ScanText, Stamp, type LucideIcon } from 'lucide-react'
import { SlidingNumber } from '@/components/motion-primitives/sliding-number'
import { RowLink, rowLinkClass } from '@/components/shared/row-link'
import { Skeleton } from '@/components/ui/skeleton'
import type { AgentRunDto, RiskLevel, RunStatus } from '@/lib/types'
import { cn, deviation, formatMoney, formatRelative } from '@/lib/utils'
import { boardColumnOf, type BoardColumn } from './pipeline'

interface Lane {
  id: Exclude<BoardColumn, 'stopped'>
  label: string
  hint: string
  icon: LucideIcon
  status: RunStatus
  tone: 'accent' | 'warning' | 'muted'
}

const LANES: Lane[] = [
  { id: 'queued', label: 'Intake', hint: 'Waiting for the model', icon: Inbox, status: 'PENDING', tone: 'muted' },
  { id: 'analyzing', label: 'Analyze', hint: 'Model call in flight', icon: ScanText, status: 'RUNNING', tone: 'accent' },
  { id: 'review', label: 'Human review', hint: 'Gate closed until decided', icon: KeyRound, status: 'AWAITING_APPROVAL', tone: 'warning' },
  { id: 'executing', label: 'Execute', hint: 'Approved, running once', icon: Stamp, status: 'APPROVED', tone: 'accent' },
  { id: 'completed', label: 'Recorded', hint: 'In the audit log', icon: Archive, status: 'COMPLETED', tone: 'muted' },
]

const RISK_DOT: Record<RiskLevel, string> = {
  low: 'bg-success-solid',
  medium: 'bg-warning-solid',
  high: 'bg-danger-solid',
}

const PER_LANE = 3

export function PipelineBoard({ runs, loading }: { runs: AgentRunDto[]; loading: boolean }) {
  const by = new Map<BoardColumn, AgentRunDto[]>()
  for (const r of runs) {
    const col = boardColumnOf(r.status)
    by.set(col, [...(by.get(col) ?? []), r])
  }
  const stopped = by.get('stopped') ?? []

  return (
    <section className="surface @container rounded-xl" aria-label="Pipeline" data-testid="pipeline-board">
      <ol className="grid grid-cols-1 gap-y-5 p-4 @3xl:grid-cols-5 @3xl:gap-x-3 sm:p-5">
        {LANES.map((lane, i) => {
          const items = by.get(lane.id) ?? []
          const nextHasWork = (by.get(LANES[i + 1]?.id ?? 'stopped')?.length ?? 0) > 0
          return (
            <li key={lane.id} className="min-w-0" data-testid={`lane-${lane.id}`}>
              <LaneHead lane={lane} count={loading ? undefined : items.length} last={i === LANES.length - 1} flowing={nextHasWork} />
              <ul className="mt-2 space-y-1.5 ps-12 empty:hidden @3xl:mt-3 @3xl:ps-0">
                {loading
                  ? <Skeleton className="h-14 w-full rounded-lg" />
                  : items.slice(0, PER_LANE).map((r) => <RunChip key={r.id} run={r} tone={lane.tone} />)}
              </ul>
              {items.length > PER_LANE && (
                <Link
                  to="/operator/runs"
                  search={{ status: lane.status }}
                  className="ms-12 mt-1.5 inline-block text-xs text-text-secondary tabular-nums hover:text-text @3xl:ms-0"
                >
                  +{items.length - PER_LANE} more
                </Link>
              )}
              {!loading && items.length === 0 && (
                <p className="hidden h-12 items-center justify-center rounded-lg border border-dashed @3xl:mt-3 @3xl:flex border-border text-xs text-text-tertiary">Empty</p>
              )}
            </li>
          )
        })}
      </ol>

      {!loading && stopped.length > 0 && (
        <div className="rounded-b-xl bg-bg-subtle px-4 py-3 sm:px-5" data-testid="lane-stopped">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 text-13 text-text-secondary">
              <Ban className="size-3.5 text-danger-text" strokeWidth={2} aria-hidden />
              <span className="font-medium text-text">Off the line</span>
              <span className="tabular-nums">{stopped.length}</span>
            </span>
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {stopped.slice(0, 6).map((r) => (
                <li key={r.id} className={cn(rowLinkClass, 'rounded-md bg-bg-surface px-2 py-1 shadow-border')}>
                  <RowLink
                    to="/operator/runs/$runId"
                    params={{ runId: String(r.id) }}
                    className="flex items-center gap-1.5 text-xs"
                    title={r.caseTitle}
                  >
                    <span className="font-mono text-text-tertiary tabular-nums">#{r.id}</span>
                    <span className="max-w-[12rem] truncate text-text">{vendorOf(r)}</span>
                    <span className="text-text-tertiary">{r.status === 'FAILED' ? 'failed' : 'rejected'}</span>
                  </RowLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function LaneHead({ lane, count, last, flowing }: { lane: Lane; count: number | undefined; last: boolean; flowing: boolean }) {
  const Icon = lane.icon
  const busy = (count ?? 0) > 0
  return (
    <Link
      to="/operator/runs"
      search={{ status: lane.status }}
      className="group relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 rounded-md outline-none @3xl:grid-cols-1 @3xl:gap-x-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div className="flex items-center">
        <span
          className={cn(
            'relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-200',
            !busy && 'bg-bg-muted text-text-tertiary',
            busy && lane.tone === 'accent' && 'bg-accent-subtle text-accent-text ring-2 ring-accent-solid ring-offset-2 ring-offset-bg-surface',
            busy && lane.tone === 'warning' && 'bg-warning-subtle text-warning-text ring-2 ring-warning-solid ring-offset-2 ring-offset-bg-surface',
            busy && lane.tone === 'muted' && 'bg-accent-solid text-text-on-accent',
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        {!last && (
          <svg aria-hidden className="ms-2 hidden h-2 w-0 min-w-0 flex-1 overflow-visible @3xl:block" preserveAspectRatio="none">
            <line
              x1="0"
              x2="100%"
              y1="4"
              y2="4"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={flowing ? '4 4' : undefined}
              className={cn(flowing ? 'stroke-accent-solid motion-safe:animate-flow' : 'stroke-border-strong')}
            />
          </svg>
        )}
      </div>
      <div className="min-w-0 @3xl:mt-3">
        <div className="flex items-baseline gap-2">
        {count === undefined ? (
          <Skeleton className="h-6 w-6" />
        ) : (
          <span className="text-2xl leading-none font-semibold tracking-[-0.015em] tabular-nums">
            <span className="sr-only">{count}</span>
            <SlidingNumber value={count} />
          </span>
        )}
        <span className="truncate text-13 font-medium text-text group-hover:underline group-hover:underline-offset-2">{lane.label}</span>
      </div>
        <p className="mt-1 truncate text-xs text-text-tertiary">{lane.hint}</p>
      </div>
    </Link>
  )
}

function RunChip({ run: r, tone }: { run: AgentRunDto; tone: Lane['tone'] }) {
  const ratio = deviation(r.inputSnapshot)
  const risk = r.output?.riskLevel
  return (
    <li
      className={cn(
        rowLinkClass,
        'rounded-lg bg-bg-surface px-2.5 py-2 shadow-border hover:shadow-border-hover',
        tone === 'warning' && 'bg-warning-subtle/50',
      )}
      data-testid={`board-run-${r.id}`}
    >
      <RowLink to="/operator/runs/$runId" params={{ runId: String(r.id) }} className="block min-w-0" title={r.caseTitle}>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-13 font-medium text-text">{vendorOf(r)}</span>
          <span className="shrink-0 font-mono text-[11px] text-text-tertiary tabular-nums">#{r.id}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-secondary tabular-nums">
          {risk && <span className={cn('size-1.5 shrink-0 rounded-full', RISK_DOT[risk])} aria-hidden />}
          <span className="truncate" title={`Updated ${formatRelative(r.updatedAt)}`}>
            {formatMoney(r.inputSnapshot.amount, r.inputSnapshot.currency)}
            {ratio !== null && ratio >= 1.5 ? ` · ${ratio.toFixed(1)}×` : ''}
          </span>
        </span>
        {risk && <span className="sr-only">{risk} risk</span>}
      </RowLink>
    </li>
  )
}

function vendorOf(r: AgentRunDto) {
  return r.inputSnapshot.vendor || r.caseTitle
}
