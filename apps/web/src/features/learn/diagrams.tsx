/**
 * Diagrams for the Learn pages, drawn in SVG with the theme tokens so they follow light
 * and dark mode. Wide diagrams sit in a horizontal scroll area on phones instead of
 * shrinking their labels to nothing.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function DiagramFrame({ children, caption, minWidth = 720, className }: { children: ReactNode; caption?: ReactNode; minWidth?: number; className?: string }) {
  return (
    <figure className={cn('surface rounded-2xl', className)}>
      <div className="overflow-x-auto overscroll-x-contain p-4 sm:p-6">
        <div style={{ minWidth }}>{children}</div>
      </div>
      {caption && <figcaption className="px-4 pb-4 text-13 text-text-secondary sm:px-6 sm:pb-6">{caption}</figcaption>}
    </figure>
  )
}

export function Legend({ items }: { items: { label: string; kind: Kind }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden className="overflow-visible">
            <line x1="0" x2="28" y1="4" y2="4" strokeWidth={2} {...strokeFor(i.kind)} />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export type Kind = 'rest' | 'ws' | 'sql' | 'llm' | 'internal'

function strokeFor(kind: Kind) {
  switch (kind) {
    case 'rest':
      return { className: 'stroke-ink' }
    case 'ws':
      return { className: 'stroke-accent-solid', strokeDasharray: '6 4' }
    case 'sql':
      return { className: 'stroke-hue-green' }
    case 'llm':
      return { className: 'stroke-hue-purple', strokeDasharray: '2 4', strokeLinecap: 'round' as const }
    case 'internal':
      return { className: 'stroke-text-tertiary', strokeDasharray: '3 3' }
  }
}

function Arrowheads() {
  const kinds: [Kind, string][] = [
    ['rest', 'fill-ink'],
    ['ws', 'fill-accent-solid'],
    ['sql', 'fill-hue-green'],
    ['llm', 'fill-hue-purple'],
    ['internal', 'fill-text-tertiary'],
  ]
  return (
    <defs>
      {kinds.map(([k, cls]) => (
        <marker key={k} id={`ah-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" className={cls} />
        </marker>
      ))}
    </defs>
  )
}

/* ------------------------------------------------------------------ system map */

function Box({
  x,
  y,
  w,
  h,
  title,
  lines = [],
  tone = 'surface',
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  lines?: string[]
  tone?: 'surface' | 'muted' | 'ink'
}) {
  const fill = tone === 'ink' ? 'fill-ink' : tone === 'muted' ? 'fill-bg-muted' : 'fill-bg-surface'
  const text = tone === 'ink' ? 'fill-text-on-ink' : 'fill-text'
  const sub = tone === 'ink' ? 'fill-text-on-ink opacity-70' : 'fill-text-secondary'
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={16} className={cn(fill, tone === 'surface' && 'stroke-border')} strokeWidth={1} />
      <text x={x + 16} y={y + 26} className={cn(text, 'text-[13px] font-semibold')}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 16} y={y + 46 + i * 17} className={cn(sub, 'text-[11.5px]')}>
          {l}
        </text>
      ))}
    </g>
  )
}

function Link_({ d, kind, label, lx, ly, anchor = 'middle' }: { d: string; kind: Kind; label?: string; lx?: number; ly?: number; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <g>
      <path d={d} fill="none" strokeWidth={1.75} markerEnd={`url(#ah-${kind})`} markerStart={kind === 'ws' || kind === 'sql' ? `url(#ah-${kind})` : undefined} {...strokeFor(kind)} />
      {label && lx !== undefined && ly !== undefined && (
        <text x={lx} y={ly} textAnchor={anchor} className="fill-text-secondary text-[11px] font-medium">
          {label}
        </text>
      )}
    </g>
  )
}

/** Two devices, one proxy, one server with four roles, one database, one model. */
export function SystemMap() {
  return (
    <svg viewBox="0 0 1100 560" className="h-auto w-full" role="img" aria-labelledby="sysmap-title sysmap-desc">
      <title id="sysmap-title">System architecture</title>
      <desc id="sysmap-desc">
        Two browsers on two devices talk only to the server, through the Caddy proxy: REST for accounts, history and decisions,
        a WebSocket for live messages and events. The server stores everything in PostgreSQL and calls a language model for the
        invoice analysis.
      </desc>
      <Arrowheads />

      {/* devices */}
      <g>
        <rect x={20} y={60} width={220} height={150} rx={20} className="fill-hue-blue-pale" />
        <image href="/avatars/alice.webp" x={38} y={78} width={40} height={40} style={{ clipPath: 'inset(0 round 20px)' }} />
        <text x={90} y={96} className="fill-text text-[13px] font-semibold">Device A · laptop</text>
        <text x={90} y={113} className="fill-text-secondary text-[11.5px]">Alice, operator</text>
        <text x={38} y={150} className="fill-text-secondary text-[11.5px]">React app in a browser</text>
        <text x={38} y={167} className="fill-text-secondary text-[11.5px]">Access token in memory</text>
        <text x={38} y={184} className="fill-text-secondary text-[11.5px]">One WebSocket while open</text>
      </g>
      <g>
        <rect x={20} y={350} width={220} height={150} rx={20} className="fill-hue-gold-pale" />
        <image href="/avatars/bob.webp" x={38} y={368} width={40} height={40} style={{ clipPath: 'inset(0 round 20px)' }} />
        <text x={90} y={386} className="fill-text text-[13px] font-semibold">Device B · phone</text>
        <text x={90} y={403} className="fill-text-secondary text-[11.5px]">Bob, reviewer</text>
        <text x={38} y={440} className="fill-text-secondary text-[11.5px]">Same app, mobile layout</text>
        <text x={38} y={457} className="fill-text-secondary text-[11.5px]">Different machine, same Wi-Fi</text>
        <text x={38} y={474} className="fill-text-secondary text-[11.5px]">Never talks to Device A</text>
      </g>

      {/* proxy */}
      <Box x={330} y={210} w={170} h={140} title="Caddy" lines={['Reverse proxy, :8080', 'Serves the web app', '/api → REST', '/ws → WebSocket']} tone="muted" />

      {/* server */}
      <rect x={570} y={30} width={290} height={500} rx={24} className="fill-bg-subtle stroke-border-strong" strokeDasharray="5 5" />
      <text x={590} y={58} className="fill-text text-[13px] font-semibold">Rust server (Axum, one process)</text>
      <Box x={590} y={76} w={250} h={86} title="REST API" lines={['Accounts, users, history', 'Cases, runs, approvals, audit']} />
      <Box x={590} y={174} w={250} h={86} title="Auth" lines={['Argon2id passwords, JWT access', 'Refresh cookie, 30 s WS ticket']} />
      <Box x={590} y={272} w={250} h={86} title="WebSocket hub · Realtime Relay" lines={['Who is online, on which sockets', 'Push: message, typing, run, approval']} />
      <Box x={590} y={370} w={250} h={140} title="Agent worker" lines={['Run Orchestrator: state machine', 'Invoice Risk Analyst: model call', 'Approval Gatekeeper: human gate', 'Case Action Executor: runs once']} tone="ink" />

      {/* database + model */}
      <g>
        <ellipse cx={1000} cy={120} rx={78} ry={16} className="fill-hue-green-pale stroke-hue-green" strokeWidth={1.5} />
        <path d="M922 120v110c0 9 35 16 78 16s78-7 78-16V120" className="fill-hue-green-pale stroke-hue-green" strokeWidth={1.5} />
        <text x={1000} y={170} textAnchor="middle" className="fill-text text-[13px] font-semibold">PostgreSQL</text>
        <text x={1000} y={188} textAnchor="middle" className="fill-text-secondary text-[11.5px]">users, messages, cases,</text>
        <text x={1000} y={205} textAnchor="middle" className="fill-text-secondary text-[11.5px]">runs, approvals, audit</text>
      </g>
      <Box x={922} y={390} w={160} h={104} title="Language model" lines={['Mock (default) or', 'LM Studio, OpenAI-', 'compatible, local']} tone="muted" />

      {/* links: devices ↔ proxy */}
      <Link_ d="M240 112 C 290 112, 300 240, 330 240" kind="rest" label="HTTPS · REST" lx={276} ly={128} />
      <Link_ d="M240 160 C 290 160, 300 268, 330 268" kind="ws" label="WebSocket" lx={300} ly={196} anchor="start" />
      <Link_ d="M240 402 C 290 402, 300 300, 330 300" kind="rest" />
      <Link_ d="M240 450 C 290 450, 300 324, 330 324" kind="ws" />

      {/* proxy ↔ server */}
      <Link_ d="M500 250 C 540 250, 550 119, 590 119" kind="rest" />
      <Link_ d="M500 300 C 540 300, 550 315, 590 315" kind="ws" />

      {/* server ↔ db / model */}
      <Link_ d="M840 119 L 922 140" kind="sql" label="SQL" lx={880} ly={118} />
      <Link_ d="M840 315 C 880 315, 890 210, 922 205" kind="sql" />
      <Link_ d="M840 440 L 922 440" kind="llm" label="HTTP JSON" lx={881} ly={432} />
      <Link_ d="M715 370 L 715 358" kind="internal" />
    </svg>
  )
}

/* ------------------------------------------------------------- sequence diagram */

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

/** Lifelines with numbered arrows. Steps are laid out top to bottom, one row each. */
export function Sequence({ actors, steps, colWidth = 170 }: { actors: Actor[]; steps: Step[]; colWidth?: number }) {
  const head = 64
  const row = 46
  const W = actors.length * colWidth
  const H = head + 24 + steps.length * row + 16
  const x = (id: string) => actors.findIndex((a) => a.id === id) * colWidth + colWidth / 2
  const numbers = steps.reduce<number[]>((acc, s) => [...acc, ('at' in s ? 0 : 1) + (acc.at(-1) ?? 0)], [])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      <Arrowheads />
      {actors.map((a) => {
        const cx = x(a.id)
        const ink = a.tone === 'ink'
        return (
          <g key={a.id}>
            <line x1={cx} x2={cx} y1={head} y2={H - 8} className="stroke-border-strong" strokeDasharray="2 4" />
            <rect x={cx - colWidth / 2 + 10} y={6} width={colWidth - 20} height={head - 14} rx={14} className={ACTOR_FILL[a.tone ?? 'muted']} />
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
        if ('at' in s) {
          const w = Math.min(W - 16, 24 + s.note.length * 6.2)
          const cx = Math.min(Math.max(x(s.at), 8 + w / 2), W - 8 - w / 2)
          const fill = s.tone === 'warning' ? 'fill-warning-subtle stroke-warning-border' : s.tone === 'success' ? 'fill-success-subtle stroke-success-border' : 'fill-bg-surface stroke-border'
          return (
            <g key={i}>
              <rect x={cx - w / 2} y={y - 14} width={w} height={26} rx={13} className={fill} />
              <text x={cx} y={y + 3.5} textAnchor="middle" className="fill-text text-[11.5px]">
                {s.note}
              </text>
            </g>
          )
        }
        const n = numbers[i]
        const x1 = x(s.from)
        const x2 = x(s.to)
        const self = x1 === x2
        const dir = x2 > x1 ? 1 : -1
        // Badge sits at the arrow's tail, the label runs from it in the arrow's direction.
        const tx = self ? x1 + 42 : x1 + dir * 28
        const anchor = self || dir > 0 ? 'start' : 'end'
        return (
          <g key={i}>
            {self ? (
              <path d={`M${x1} ${y - 6} h 34 v 14 h -30`} fill="none" strokeWidth={1.75} markerEnd={`url(#ah-${s.kind})`} {...strokeFor(s.kind)} />
            ) : (
              <line x1={x1 + dir * 4} x2={x2 - dir * 6} y1={y} y2={y} strokeWidth={1.75} markerEnd={`url(#ah-${s.kind})`} {...strokeFor(s.kind)} />
            )}
            <circle cx={self ? x1 : x1 + dir * 14} cy={y - 13} r={8} className="fill-ink" />
            <text x={self ? x1 : x1 + dir * 14} y={y - 9.5} textAnchor="middle" className="fill-text-on-ink text-[9.5px] font-semibold">
              {n}
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
  )
}

/* ---------------------------------------------------------------- state machine */

const STATES: { id: string; label: string; x: number; y: number; tone: 'muted' | 'blue' | 'gold' | 'green' | 'red' }[] = [
  { id: 'PENDING', label: 'Queued', x: 10, y: 140, tone: 'muted' },
  { id: 'RUNNING', label: 'Analyzing / running', x: 210, y: 140, tone: 'blue' },
  { id: 'AWAITING_APPROVAL', label: 'Awaiting approval', x: 430, y: 140, tone: 'gold' },
  { id: 'APPROVED', label: 'Approved', x: 650, y: 80, tone: 'green' },
  { id: 'REJECTED', label: 'Rejected', x: 650, y: 200, tone: 'red' },
  { id: 'CANCELLED', label: 'Cancelled', x: 830, y: 200, tone: 'muted' },
  { id: 'FAILED', label: 'Failed', x: 110, y: 262, tone: 'red' },
  { id: 'COMPLETED', label: 'Completed', x: 430, y: 262, tone: 'green' },
]

const STATE_FILL = {
  muted: 'fill-bg-muted',
  blue: 'fill-accent-subtle stroke-accent-border',
  gold: 'fill-warning-subtle stroke-warning-border',
  green: 'fill-success-subtle stroke-success-border',
  red: 'fill-danger-subtle stroke-danger-border',
}

export function RunStateMachine() {
  const W = 150
  const H = 44
  const label = (text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} className="fill-text-secondary text-[11px]">
      {text}
    </text>
  )
  const edge = (d: string, kind: Kind = 'internal') => <path d={d} fill="none" strokeWidth={1.6} markerEnd={`url(#ah-${kind})`} {...strokeFor(kind)} />
  return (
    <svg viewBox="0 0 980 320" className="h-auto w-full" role="img" aria-label="Run state machine">
      <Arrowheads />
      {edge('M160 162 L206 162', 'rest')}
      {edge('M360 162 L426 162', 'rest')}
      {edge('M580 154 C 612 154, 612 102, 646 102', 'rest')}
      {label('approve', 606, 116, 'end')}
      {edge('M580 170 C 612 170, 612 222, 646 222', 'rest')}
      {label('reject', 606, 214, 'end')}
      {edge('M800 222 L826 222')}
      {edge('M725 80 C 725 20, 285 20, 285 136')}
      {label('approved: back to running to execute the action once', 490, 86)}
      {edge('M300 184 C 300 284, 360 284, 426 284')}
      {label('no action needed, or action done', 318, 232, 'start')}
      {edge('M240 184 L240 258')}
      {label('model fails twice', 232, 226, 'end')}
      {edge('M60 184 C 60 284, 80 284, 106 284')}
      {STATES.map((s) => (
        <g key={s.id}>
          <rect x={s.x} y={s.y} width={W} height={H} rx={22} className={STATE_FILL[s.tone]} strokeWidth={1} />
          <text x={s.x + W / 2} y={s.y + 19} textAnchor="middle" className="fill-text text-[12.5px] font-semibold">
            {s.label}
          </text>
          <text x={s.x + W / 2} y={s.y + 34} textAnchor="middle" className="fill-text-tertiary font-mono text-[9.5px]">
            {s.id}
          </text>
        </g>
      ))}
    </svg>
  )
}
