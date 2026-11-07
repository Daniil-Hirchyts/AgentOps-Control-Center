/**
 * Pipeline track — the run's five stages as a 2D track. Each stage keeps its icon (identity);
 * state shows as fill, ring and a word underneath (never colour alone). The connector into
 * the live stage flows; skipped stages are dashed.
 *
 * `compact` renders five segments for tables and lists, with a text label for screen readers.
 */
import { Archive, Ban, Check, Inbox, KeyRound, ScanText, Stamp, X, type LucideIcon } from 'lucide-react'
import type { AgentRunDto } from '@/lib/types'
import { cn } from '@/lib/utils'
import { currentStage, pipelineOf, type Stage, type StageId, type StageState } from './pipeline'

const ICON: Record<StageId, LucideIcon> = {
  intake: Inbox,
  analyze: ScanText,
  review: KeyRound,
  execute: Stamp,
  done: Archive,
}

const NODE: Record<StageState, string> = {
  done: 'bg-ink text-text-on-ink',
  active: 'bg-accent-subtle text-accent-text ring-2 ring-accent-solid ring-offset-2 ring-offset-bg-surface',
  waiting: 'bg-warning-subtle text-warning-text ring-2 ring-warning-solid ring-offset-2 ring-offset-bg-surface',
  failed: 'bg-danger-solid text-white',
  stopped: 'bg-danger-subtle text-danger-text ring-1 ring-danger-border',
  skipped: 'border border-dashed border-border-strong text-text-disabled',
  upcoming: 'bg-bg-muted text-text-tertiary',
}

const WORD: Record<StageState, string> = {
  done: 'Done',
  active: 'In progress',
  waiting: 'Waiting',
  failed: 'Failed',
  stopped: 'Stopped',
  skipped: 'Skipped',
  upcoming: 'Next',
}

type RunLike = Pick<AgentRunDto, 'status' | 'output' | 'approval' | 'error'>

function summary(stages: Stage[], current: StageId) {
  const s = stages.find((x) => x.id === current)!
  return `Pipeline: ${s.label}, ${WORD[s.state].toLowerCase()}${s.detail ? ` (${s.detail})` : ''}`
}

export function PipelineTrack({ run, compact = false, className }: { run: RunLike; compact?: boolean; className?: string }) {
  const stages = pipelineOf(run)
  const current = currentStage(run)

  if (compact) {
    return (
      <span
        className={cn('inline-flex items-center gap-[3px]', className)}
        role="img"
        aria-label={summary(stages, current)}
        data-testid="pipeline-compact"
        data-stage={current}
      >
        {stages.map((s) => (
          <span
            key={s.id}
            className={cn(
              'h-1.5 w-3.5 rounded-full transition-colors duration-200',
              s.state === 'done' && 'bg-ink',
              s.state === 'active' && 'animate-pulse-soft bg-accent-solid',
              s.state === 'waiting' && 'bg-warning-solid',
              (s.state === 'failed' || s.state === 'stopped') && 'bg-danger-solid',
              s.state === 'skipped' && 'border border-dashed border-border-strong',
              s.state === 'upcoming' && 'bg-bg-active',
            )}
          />
        ))}
      </span>
    )
  }

  return (
    <div className={cn('@container', className)} data-testid="pipeline-track" data-stage={current}>
      <ol className="grid grid-cols-5 gap-x-1.5 @lg:gap-x-2" aria-label={summary(stages, current)}>
        {stages.map((s, i) => {
          const Icon = s.state === 'done' ? Check : s.state === 'failed' ? X : s.state === 'stopped' ? Ban : ICON[s.id]
          const next = stages[i + 1]
          const live = next && (next.state === 'active' || next.state === 'waiting')
          return (
            <li
              key={s.id}
              className="relative grid min-w-0 grid-cols-1 items-start gap-y-2"
              data-state={s.state}
              aria-current={s.id === current ? 'step' : undefined}
            >
              <div className="relative flex w-full items-center">
                <span
                  className={cn(
                    'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-200',
                    NODE[s.state],
                  )}
                >
                  <Icon className="size-4" strokeWidth={s.state === 'done' ? 2.25 : 1.75} aria-hidden />
                </span>
                {next && <Connector state={s.state} nextState={next.state} live={!!live} />}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-xs leading-tight font-medium break-words @md:truncate @lg:text-13',
                    s.state === 'upcoming' || s.state === 'skipped' ? 'text-text-tertiary' : 'text-text',
                  )}
                >
                  {s.label}
                </p>
                <p className="hidden truncate text-xs text-text-tertiary @md:block" title={s.detail}>
                  <span className="sr-only">{WORD[s.state]}. </span>
                  {s.detail || WORD[s.state]}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Connector({ state, nextState, live }: { state: StageState; nextState: StageState; live: boolean }) {
  const solid = state === 'done' && (nextState === 'done' || live)
  const dashed = nextState === 'skipped' || state === 'skipped'
  return (
    <svg
      aria-hidden
      className="absolute start-10 top-1/2 h-2 w-[calc(100%-2.25rem)] -translate-y-1/2 overflow-visible @lg:w-[calc(100%-2rem)]"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        x2="100%"
        y1="4"
        y2="4"
        strokeWidth={1.5}
        strokeLinecap="round"
        className={cn(
          'transition-[stroke] duration-200',
          live ? 'stroke-accent-solid' : solid ? 'stroke-ink' : 'stroke-border-strong',
          live && 'motion-safe:animate-flow',
        )}
        strokeDasharray={live ? '4 4' : dashed ? '2 4' : undefined}
      />
    </svg>
  )
}
