import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRuns } from '@/features/agents/hooks'
import type { RunStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useTraffic } from '@/stores/traffic'
import { type Kind, strokeFor, usePlayer } from './model'
import { Arrowheads, DiagramFrame, PlayerControls } from './shared'

type Tone = 'muted' | 'blue' | 'gold' | 'green' | 'red'

const STATES: Record<RunStatus, { label: string; x: number; y: number; tone: Tone; text: string }> = {
  PENDING: {
    label: 'Queued',
    x: 10,
    y: 140,
    tone: 'muted',
    text: 'The run exists and waits for the worker. Nothing has been sent to the model yet.',
  },
  RUNNING: {
    label: 'Analyzing / running',
    x: 210,
    y: 140,
    tone: 'blue',
    text: 'The Invoice Risk Analyst is calling the model, or the Executor is carrying out an approved action.',
  },
  AWAITING_APPROVAL: {
    label: 'Awaiting approval',
    x: 430,
    y: 140,
    tone: 'gold',
    text: 'The agent proposed an action that changes records. The run is parked until the assigned reviewer decides.',
  },
  APPROVED: {
    label: 'Approved',
    x: 650,
    y: 80,
    tone: 'green',
    text: 'The reviewer said yes. The run goes back to running to execute the action, exactly once.',
  },
  REJECTED: {
    label: 'Rejected',
    x: 650,
    y: 200,
    tone: 'red',
    text: 'The reviewer said no. Nothing is executed; the run is closed as cancelled.',
  },
  CANCELLED: { label: 'Cancelled', x: 830, y: 200, tone: 'muted', text: 'Closed without acting, after a rejection.' },
  FAILED: {
    label: 'Failed',
    x: 110,
    y: 262,
    tone: 'red',
    text: 'The model timed out, was down, or answered in a shape we could not trust, twice. Nothing is executed.',
  },
  COMPLETED: {
    label: 'Completed',
    x: 430,
    y: 262,
    tone: 'green',
    text: 'Finished: either no action was needed, or the approved action ran once. Everything is in the audit log.',
  },
}

type EdgeId = 'p-r' | 'r-a' | 'a-ap' | 'a-rj' | 'rj-c' | 'ap-r' | 'r-c' | 'r-f' | 'p-f'

const EDGES: Record<
  EdgeId,
  { from: RunStatus; to: RunStatus; d: string; kind: Kind; label?: [string, number, number, 'start' | 'middle' | 'end'] }
> = {
  'p-r': { from: 'PENDING', to: 'RUNNING', d: 'M160 162 L206 162', kind: 'rest' },
  'r-a': { from: 'RUNNING', to: 'AWAITING_APPROVAL', d: 'M360 162 L426 162', kind: 'rest' },
  'a-ap': {
    from: 'AWAITING_APPROVAL',
    to: 'APPROVED',
    d: 'M580 154 C 612 154, 612 102, 646 102',
    kind: 'rest',
    label: ['approve', 606, 116, 'end'],
  },
  'a-rj': {
    from: 'AWAITING_APPROVAL',
    to: 'REJECTED',
    d: 'M580 170 C 612 170, 612 222, 646 222',
    kind: 'rest',
    label: ['reject', 606, 214, 'end'],
  },
  'rj-c': { from: 'REJECTED', to: 'CANCELLED', d: 'M800 222 L826 222', kind: 'internal' },
  'ap-r': {
    from: 'APPROVED',
    to: 'RUNNING',
    d: 'M725 80 C 725 20, 285 20, 285 136',
    kind: 'internal',
    label: ['approved: back to running to execute the action once', 490, 86, 'middle'],
  },
  'r-c': {
    from: 'RUNNING',
    to: 'COMPLETED',
    d: 'M300 184 C 300 284, 360 284, 426 284',
    kind: 'internal',
    label: ['no action needed, or action done', 318, 232, 'start'],
  },
  'r-f': { from: 'RUNNING', to: 'FAILED', d: 'M240 184 L240 258', kind: 'internal', label: ['model fails twice', 232, 226, 'end'] },
  'p-f': { from: 'PENDING', to: 'FAILED', d: 'M60 184 C 60 284, 80 284, 106 284', kind: 'internal' },
}

const PATHS: { id: string; label: string; states: RunStatus[] }[] = [
  { id: 'approved', label: 'Approved', states: ['PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'APPROVED', 'RUNNING', 'COMPLETED'] },
  { id: 'rejected', label: 'Rejected', states: ['PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'REJECTED', 'CANCELLED'] },
  { id: 'routine', label: 'No action', states: ['PENDING', 'RUNNING', 'COMPLETED'] },
  { id: 'failure', label: 'Model fails', states: ['PENDING', 'RUNNING', 'FAILED'] },
]

const FILL: Record<Tone, string> = {
  muted: 'fill-bg-muted stroke-border',
  blue: 'fill-accent-subtle stroke-accent-border',
  gold: 'fill-warning-subtle stroke-warning-border',
  green: 'fill-success-subtle stroke-success-border',
  red: 'fill-danger-subtle stroke-danger-border',
}

const edgeBetween = (a: RunStatus, b: RunStatus) => (Object.keys(EDGES) as EdgeId[]).find((e) => EDGES[e].from === a && EDGES[e].to === b)

export function RunStateMachine() {
  const role = useAuthStore((s) => s.user?.role)
  const navigate = useNavigate()
  const [pathId, setPathId] = useState(PATHS[0]!.id)
  const path = PATHS.find((p) => p.id === pathId)!
  const [hover, setHover] = useState<RunStatus | null>(null)
  const [focused, setFocused] = useState<RunStatus | null>(null)
  // Left alone, it plays every path in turn; pointing at a state pauses it.
  const { attach, ...player } = usePlayer(path.states.length, 1100, {
    suspended: Boolean(hover ?? focused),
    onLoop: (auto) => {
      if (auto) setPathId((id) => PATHS[(PATHS.findIndex((p) => p.id === id) + 1) % PATHS.length]!.id)
    },
  })

  // Live: how many of the runs you can see sit in each state right now.
  const { data: runs } = useRuns({ limit: 100 })
  const counts = (runs && 'items' in runs ? runs.items : []).reduce<Partial<Record<RunStatus, number>>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  )

  // Live: a run changing state anywhere you can see pulses that state.
  const frames = useTraffic((s) => s.frames)
  const seen = useRef(frames[0]?.id ?? 0)
  const [pulse, setPulse] = useState<{ state: RunStatus; key: number } | null>(null)
  useEffect(() => {
    const fresh = frames.find((f) => f.id > seen.current && f.label === 'agent_status' && f.detail)
    seen.current = frames[0]?.id ?? seen.current
    if (fresh && fresh.detail && fresh.detail in STATES) {
      const t = setTimeout(() => setPulse({ state: fresh.detail as RunStatus, key: fresh.id }), 0)
      return () => clearTimeout(t)
    }
  }, [frames])

  // What is lit: the hovered or focused state's transitions, else the path being played.
  const pointed = hover ?? focused
  const playing = player.index >= 0 && !pointed
  const visited = playing ? path.states.slice(0, player.index + 1) : []
  const currentState = playing ? path.states[player.index] : undefined
  const pathEdges = new Set(
    visited
      .slice(1)
      .map((s, i) => edgeBetween(visited[i]!, s))
      .filter(Boolean) as EdgeId[],
  )
  const lens = pointed
  const lensEdges = lens ? new Set((Object.keys(EDGES) as EdgeId[]).filter((e) => EDGES[e].from === lens || EDGES[e].to === lens)) : null
  const describe = currentState ?? lens
  const touchesLens = (id: RunStatus) => !lensEdges || [...lensEdges].some((e) => EDGES[e].from === id || EDGES[e].to === id)

  const open = (s: RunStatus) => {
    if (role === 'OPERATOR') void navigate({ to: '/operator/runs', search: { status: s } })
  }

  return (
    <DiagramFrame
      ref={attach}
      label="Run state machine"
      minWidth={860}
      toolbar={
        <>
          <div role="radiogroup" aria-label="Path to play" className="flex flex-wrap gap-1">
            {PATHS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === pathId}
                onClick={() => {
                  setPathId(p.id)
                  player.restart()
                }}
                className={cn(
                  'pressable inline-flex h-8 items-center rounded-full px-3.5 text-13 font-medium transition-colors duration-150',
                  p.id === pathId ? 'bg-bg-surface text-text shadow-border' : 'text-text-secondary hover:bg-bg-muted hover:text-text',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="ms-auto">
            <PlayerControls player={player} label="Run state machine" />
          </span>
        </>
      }
      footer={
        <p className="min-h-10 text-13 text-text-secondary" aria-live={player.auto ? 'off' : 'polite'}>
          {describe ? (
            <>
              <span className="font-medium text-text">{STATES[describe].label}.</span> {STATES[describe].text}
            </>
          ) : (
            <>
              Numbers are your runs in each state, right now. {role === 'OPERATOR' ? 'Select a state to list them, or play' : 'Play'} a path
              to follow one run.
            </>
          )}
        </p>
      }
    >
      <svg viewBox="0 0 980 320" className="h-auto w-full" aria-label="Run states and transitions">
        <Arrowheads />
        {(Object.keys(EDGES) as EdgeId[]).map((id) => {
          const e = EDGES[id]
          const on = pathEdges.has(id) || (lensEdges?.has(id) ?? false)
          const dim = (playing && !pathEdges.has(id)) || (lensEdges && !lensEdges.has(id))
          return (
            <g key={id} className={cn('transition-opacity duration-200', dim && 'opacity-20')}>
              <path
                d={e.d}
                fill="none"
                strokeWidth={on ? 2.6 : 1.6}
                markerEnd={`url(#ah-${on && playing ? 'ws' : e.kind})`}
                {...(on && playing ? { className: 'stroke-accent-solid' } : strokeFor(e.kind))}
              />
              {e.label && (
                <text x={e.label[1]} y={e.label[2]} textAnchor={e.label[3]} className="fill-text-secondary text-[11px]">
                  {e.label[0]}
                </text>
              )}
            </g>
          )
        })}

        {(Object.keys(STATES) as RunStatus[]).map((id) => {
          const s = STATES[id]
          const W = 150
          const H = 44
          const isCurrent = currentState === id
          const dim = (playing && !visited.includes(id)) || (lens !== null && lens !== id && !touchesLens(id))
          const count = counts[id]
          return (
            <g
              key={id}
              tabIndex={0}
              role={role === 'OPERATOR' ? 'link' : 'img'}
              aria-label={`${s.label}${count ? `, ${count} runs` : ''}`}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setFocused(id)}
              onBlur={() => setFocused(null)}
              onClick={() => open(id)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') open(id)
              }}
              className={cn('outline-none transition-opacity duration-200', role === 'OPERATOR' && 'cursor-pointer', dim && 'opacity-35')}
            >
              {pulse?.state === id && (
                <rect
                  key={pulse.key}
                  x={s.x}
                  y={s.y}
                  width={W}
                  height={H}
                  rx={22}
                  className="animate-state-pulse fill-none stroke-accent-solid"
                  strokeWidth={2}
                />
              )}
              <rect x={s.x} y={s.y} width={W} height={H} rx={22} className={FILL[s.tone]} strokeWidth={1} />
              {(isCurrent || focused === id) && (
                <rect
                  x={s.x - 4}
                  y={s.y - 4}
                  width={W + 8}
                  height={H + 8}
                  rx={26}
                  fill="none"
                  className={isCurrent ? 'stroke-accent-solid' : 'stroke-focus'}
                  strokeWidth={2.5}
                />
              )}
              <text x={s.x + W / 2} y={s.y + 19} textAnchor="middle" className="fill-text text-[12.5px] font-semibold">
                {s.label}
              </text>
              <text x={s.x + W / 2} y={s.y + 34} textAnchor="middle" className="fill-text-tertiary font-mono text-[9.5px]">
                {id}
              </text>
              {count ? (
                <g>
                  <rect
                    x={s.x + W - 18}
                    y={s.y - 9}
                    width={Math.max(22, 10 + String(count).length * 7)}
                    height={20}
                    rx={10}
                    className="fill-ink"
                  />
                  <text
                    x={s.x + W - 18 + Math.max(22, 10 + String(count).length * 7) / 2}
                    y={s.y + 5}
                    textAnchor="middle"
                    className="fill-text-on-ink text-[11px] font-semibold tabular-nums"
                  >
                    {count}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
      </svg>
    </DiagramFrame>
  )
}
