import { cn } from '@/lib/utils'
import { type Kind, PACKET_FILL, strokeFor, usePlayer, useReducedMotion, useTween } from './model'
import { Arrowheads, DiagramFrame, PlayerControls } from './shared'

export interface Actor {
  id: string
  label: string
  sub?: string
  tone?: 'blue' | 'gold' | 'ink' | 'green' | 'purple' | 'muted'
}

export type Step =
  | { from: string; to: string; label: string; kind: Kind; note?: string }
  | { at: string; note: string; tone?: 'warning' | 'success' | 'muted' }

const ACTOR_FILL: Record<NonNullable<Actor['tone']>, string> = {
  blue: 'fill-hue-blue-pale',
  gold: 'fill-hue-gold-pale',
  ink: 'fill-ink',
  green: 'fill-hue-green-pale',
  purple: 'fill-hue-purple-pale',
  muted: 'fill-bg-muted',
}

/**
 * Lifelines with numbered arrows, one row per step. Press play and the steps light up in
 * order, with a packet travelling along the current arrow; or click any step to jump to it.
 * At rest every step is shown, so the diagram still reads as a static figure.
 */
export function Sequence({ label, actors, steps, colWidth = 170 }: { label: string; actors: Actor[]; steps: Step[]; colWidth?: number }) {
  const player = usePlayer(steps.length)
  const current = player.index
  const reduced = useReducedMotion()
  const head = 64
  const row = 46
  const W = actors.length * colWidth
  const H = head + 24 + steps.length * row + 16
  const x = (id: string) => actors.findIndex((a) => a.id === id) * colWidth + colWidth / 2
  const numbers = steps.reduce<number[]>((acc, s) => [...acc, ('at' in s ? 0 : 1) + (acc.at(-1) ?? 0)], [])
  const step = current >= 0 ? steps[current] : undefined

  return (
    <DiagramFrame
      label={label}
      minWidth={W}
      toolbar={<PlayerControls player={player} label={label} />}
      footer={
        <p className="min-h-10 text-13 text-text-secondary" aria-live="polite">
          {step ? (
            <>
              <span className="font-medium text-text">
                {'at' in step ? step.note : step.label}
              </span>
              {'at' in step ? null : step.note ? <> · {step.note}</> : null}
            </>
          ) : (
            'Press play to watch it happen step by step, or select a step.'
          )}
        </p>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        <Arrowheads />
        {actors.map((a) => {
          const cx = x(a.id)
          const ink = a.tone === 'ink'
          const involved = step && ('at' in step ? step.at === a.id : step.from === a.id || step.to === a.id)
          return (
            <g key={a.id}>
              <line x1={cx} x2={cx} y1={head} y2={H - 8} className="stroke-border-strong" strokeDasharray="2 4" />
              <rect
                x={cx - colWidth / 2 + 10}
                y={6}
                width={colWidth - 20}
                height={head - 14}
                rx={14}
                className={cn(ACTOR_FILL[a.tone ?? 'muted'], 'transition-[stroke-width] duration-150', involved ? 'stroke-accent-solid' : 'stroke-transparent')}
                strokeWidth={involved ? 2 : 0}
              />
              <text x={cx} y={a.sub ? 28 : 36} textAnchor="middle" className={cn('text-[12.5px] font-semibold', ink ? 'fill-text-on-ink' : 'fill-text')}>
                {a.label}
              </text>
              {a.sub && (
                <text x={cx} y={44} textAnchor="middle" className={cn('text-[11px]', ink ? 'fill-text-on-ink opacity-70' : 'fill-text-secondary')}>
                  {a.sub}
                </text>
              )}
            </g>
          )
        })}

        {steps.map((s, i) => {
          const y = head + 30 + i * row
          const state = current < 0 ? 'rest' : i < current ? 'past' : i === current ? 'current' : 'future'
          const groupProps = {
            onClick: () => player.go(i),
            className: cn('cursor-pointer transition-opacity duration-200', state === 'future' && 'opacity-25'),
          }
          // Full-width hit row so a step is easy to click.
          const hit = <rect x={0} y={y - 22} width={W} height={row} className="fill-transparent" />

          if ('at' in s) {
            const w = Math.min(W - 16, 24 + s.note.length * 6.2)
            const cx = Math.min(Math.max(x(s.at), 8 + w / 2), W - 8 - w / 2)
            const fill =
              s.tone === 'warning'
                ? 'fill-warning-subtle stroke-warning-border'
                : s.tone === 'success'
                  ? 'fill-success-subtle stroke-success-border'
                  : 'fill-bg-surface stroke-border'
            return (
              <g key={i} {...groupProps}>
                {hit}
                <rect
                  x={cx - w / 2}
                  y={y - 14}
                  width={w}
                  height={26}
                  rx={13}
                  className={cn(fill, state === 'current' && 'stroke-accent-solid')}
                  strokeWidth={state === 'current' ? 2 : 1}
                />
                <text x={cx} y={y + 3.5} textAnchor="middle" className="fill-text text-[11.5px]">
                  {s.note}
                </text>
              </g>
            )
          }

          const x1 = x(s.from)
          const x2 = x(s.to)
          const self = x1 === x2
          const dir = x2 > x1 ? 1 : -1
          // The badge sits at the arrow's tail and the label runs from it in the arrow's direction.
          const tx = self ? x1 + 42 : x1 + dir * 28
          const anchor = self || dir > 0 ? 'start' : 'end'
          const live = state === 'current'
          return (
            <g key={i} {...groupProps}>
              {hit}
              {self ? (
                <path d={`M${x1} ${y - 6} h 34 v 14 h -30`} fill="none" strokeWidth={live ? 2.5 : 1.75} markerEnd={`url(#ah-${s.kind})`} {...strokeFor(s.kind)} />
              ) : (
                <line x1={x1 + dir * 4} x2={x2 - dir * 6} y1={y} y2={y} strokeWidth={live ? 2.5 : 1.75} markerEnd={`url(#ah-${s.kind})`} {...strokeFor(s.kind)} />
              )}
              {live && !self && <TravellingDot key={`dot-${i}`} x1={x1} x2={x2} y={y} kind={s.kind} reduced={reduced} />}
              <circle cx={self ? x1 : x1 + dir * 14} cy={y - 13} r={8} className={live ? 'fill-accent-solid' : 'fill-ink'} />
              <text x={self ? x1 : x1 + dir * 14} y={y - 9.5} textAnchor="middle" className="fill-text-on-ink text-[9.5px] font-semibold">
                {numbers[i]}
              </text>
              <text x={tx} y={y - 9} textAnchor={anchor} className="fill-text text-[11.5px] font-medium">
                {s.label}
              </text>
              {s.note && (
                <text x={tx} y={y + 15} textAnchor={anchor} className="fill-text-tertiary text-[10.5px]">
                  {s.note}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </DiagramFrame>
  )
}

function TravellingDot({ x1, x2, y, kind, reduced }: { x1: number; x2: number; y: number; kind: Kind; reduced: boolean }) {
  const t = useTween(`${x1}-${x2}-${y}`, 650, 0, !reduced)
  if (reduced) return null
  return <circle cx={x1 + (x2 - x1) * t} cy={y} r={5} className={cn(PACKET_FILL[kind], 'stroke-bg-surface')} strokeWidth={2} />
}
