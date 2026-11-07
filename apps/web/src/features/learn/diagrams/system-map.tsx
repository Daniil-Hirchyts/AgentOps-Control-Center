import { Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { UserAvatar } from '@/components/shared/presence'
import { useUsers } from '@/features/messaging/hooks'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import { type Frame, useTraffic } from '@/stores/traffic'
import { age, type Kind, PACKET_FILL, strokeFor, useInView, useNow, useReducedMotion } from './model'
import { Arrowheads, DiagramFrame, Legend } from './shared'

/* ------------------------------------------------------------------ model */

type NodeId = 'a' | 'b' | 'caddy' | 'rest' | 'auth' | 'hub' | 'worker' | 'db' | 'llm'
type LinkId = 'a-rest' | 'a-ws' | 'b-rest' | 'b-ws' | 'caddy-rest' | 'caddy-ws' | 'rest-db' | 'hub-db' | 'worker-llm' | 'worker-hub'

const LINKS: Record<
  LinkId,
  { d: string; kind: Kind; both?: boolean; nodes: [NodeId, NodeId]; label?: [string, number, number, ('start' | 'middle' | 'end')?] }
> = {
  'a-rest': { d: 'M240 112 C 290 112, 300 240, 330 240', kind: 'rest', nodes: ['a', 'caddy'], label: ['HTTPS · REST', 292, 102] },
  'a-ws': {
    d: 'M240 160 C 290 160, 300 268, 330 268',
    kind: 'ws',
    both: true,
    nodes: ['a', 'caddy'],
    label: ['WebSocket', 294, 238, 'end'],
  },
  'b-rest': { d: 'M240 402 C 290 402, 300 300, 330 300', kind: 'rest', nodes: ['b', 'caddy'] },
  'b-ws': { d: 'M240 450 C 290 450, 300 324, 330 324', kind: 'ws', both: true, nodes: ['b', 'caddy'] },
  'caddy-rest': { d: 'M500 250 C 540 250, 550 119, 590 119', kind: 'rest', nodes: ['caddy', 'rest'] },
  'caddy-ws': { d: 'M500 300 C 540 300, 550 315, 590 315', kind: 'ws', both: true, nodes: ['caddy', 'hub'] },
  'rest-db': { d: 'M840 119 L 922 140', kind: 'sql', both: true, nodes: ['rest', 'db'], label: ['SQL', 880, 118] },
  'hub-db': { d: 'M840 315 C 880 315, 890 210, 922 205', kind: 'sql', both: true, nodes: ['hub', 'db'] },
  'worker-llm': { d: 'M840 440 L 922 440', kind: 'llm', nodes: ['worker', 'llm'], label: ['HTTP', 882, 430] },
  'worker-hub': { d: 'M715 370 L 715 358', kind: 'internal', nodes: ['worker', 'hub'] },
}

const NODES: Record<NodeId, { title: string; text: string; box: [number, number, number, number] }> = {
  a: {
    title: 'Device A · Alice’s laptop',
    text: 'The React app in a browser. It keeps the access token in memory, asks the REST API for data, and holds one WebSocket open to receive pushes.',
    box: [20, 60, 220, 150],
  },
  b: {
    title: 'Device B · Bob’s phone',
    text: 'The same app on another machine. It never talks to Device A: everything goes through the server, which is why it still works when one side is offline.',
    box: [20, 350, 220, 150],
  },
  caddy: {
    title: 'Caddy',
    text: 'The one public door. It serves the built web app, sends /api to the REST API and upgrades /ws to the WebSocket hub, so both devices use a single address.',
    box: [330, 210, 170, 140],
  },
  rest: {
    title: 'REST API',
    text: 'One request, one answer: accounts, the user list, message history, cases, runs, approvals and the audit log. Every route checks the token and the role.',
    box: [590, 76, 250, 86],
  },
  auth: {
    title: 'Auth',
    text: 'Checks passwords with Argon2id, issues a 15-minute access token and an HttpOnly refresh cookie, and hands out 30-second single-use tickets to open a socket.',
    box: [590, 174, 250, 86],
  },
  hub: {
    title: 'WebSocket hub · Realtime Relay',
    text: 'Knows who is online and on which sockets. It saves a message first, then pushes it to every open socket of the recipient, plus typing, presence, run and approval events.',
    box: [590, 272, 250, 86],
  },
  worker: {
    title: 'Agent worker',
    text: 'Runs each analysis: the Orchestrator moves the run through its states, the Analyst calls the model, the Gatekeeper waits for a person, the Executor acts once.',
    box: [590, 370, 250, 140],
  },
  db: {
    title: 'PostgreSQL',
    text: 'The single source of truth. Messages wait here for offline people, runs survive a restart, and the audit log records who did what.',
    box: [922, 104, 156, 142],
  },
  llm: {
    title: 'Language model',
    text: 'A deterministic mock by default, or a local LM Studio model. Its answer is only a recommendation and is validated against a strict schema.',
    box: [922, 390, 160, 104],
  },
}

/** Auth has no wire of its own: it guards the two that come in from Caddy. */
const GUARDS: Partial<Record<NodeId, LinkId[]>> = { auth: ['caddy-rest', 'caddy-ws'] }
const linksOf = (n: NodeId) => [...(Object.keys(LINKS) as LinkId[]).filter((l) => LINKS[l].nodes.includes(n)), ...(GUARDS[n] ?? [])]
const neighbours = (n: NodeId) => new Set([n, ...linksOf(n).flatMap((l) => LINKS[l].nodes)])

/* ---------------------------------------------------------------- trips */

type Hop = { link: LinkId; reverse?: boolean; at: number }
type Trip = { id: number; hops: Hop[] }

const HOP_MS = 520

/** Which wires a frame travels along, from this browser's point of view. */
function tripFor(f: Frame, side: 'a' | 'b'): Hop[] {
  const rest: LinkId = side === 'a' ? 'a-rest' : 'b-rest'
  const ws: LinkId = side === 'a' ? 'a-ws' : 'b-ws'
  if (f.channel === 'rest')
    return [
      { link: rest, at: 0 },
      { link: 'caddy-rest', at: 1 },
      { link: 'rest-db', at: 2 },
    ]
  if (f.dir === 'out') {
    const hops: Hop[] = [
      { link: ws, at: 0 },
      { link: 'caddy-ws', at: 1 },
    ]
    if (f.label === 'message') hops.push({ link: 'hub-db', at: 2 })
    return hops
  }
  const fromWorker = f.label === 'agent_status' || f.label === 'approval_requested'
  const o = fromWorker ? 1 : 0
  return [
    ...(fromWorker ? [{ link: 'worker-hub' as const, at: 0 }] : []),
    { link: 'caddy-ws', reverse: true, at: o },
    { link: ws, reverse: true, at: o + 1 },
  ]
}

function spanOf(hops: Hop[]) {
  return (Math.max(...hops.map((h) => h.at)) + 1) * HOP_MS + 200
}

const DEMOS: { id: string; label: string; hops: Hop[] }[] = [
  {
    id: 'message',
    label: 'Replay a message',
    hops: [
      { link: 'a-ws', at: 0 },
      { link: 'caddy-ws', at: 1 },
      { link: 'hub-db', at: 2 },
      { link: 'caddy-ws', reverse: true, at: 3 },
      { link: 'b-ws', reverse: true, at: 4 },
      { link: 'a-ws', reverse: true, at: 4 },
    ],
  },
  {
    id: 'approval',
    label: 'Replay an approval',
    hops: [
      { link: 'a-rest', at: 0 },
      { link: 'caddy-rest', at: 1 },
      { link: 'rest-db', at: 2 },
      { link: 'worker-llm', at: 3 },
      { link: 'worker-llm', reverse: true, at: 4 },
      { link: 'worker-hub', at: 5 },
      { link: 'caddy-ws', reverse: true, at: 6 },
      { link: 'b-ws', reverse: true, at: 7 },
      { link: 'b-rest', at: 9 },
      { link: 'caddy-rest', at: 10 },
      { link: 'rest-db', at: 11 },
    ],
  },
]

/* --------------------------------------------------------------- component */

export function SystemMap() {
  const role = useAuthStore((s) => s.user?.role)
  const side = role === 'REVIEWER' ? 'b' : 'a'
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<NodeId | null>(null)
  const [pinned, setPinned] = useState<NodeId | null>(null)
  const [focused, setFocused] = useState<NodeId | null>(null)
  const active = hover ?? pinned
  const [trips, setTrips] = useState<Trip[]>([])
  const tripSeq = useRef(0)

  const launch = useCallback((hops: Hop[]) => {
    const id = ++tripSeq.current
    setTrips((t) => [...t.slice(-6), { id, hops }])
    setTimeout(() => setTrips((t) => t.filter((x) => x.id !== id)), spanOf(hops))
  }, [])

  // The tour: while the map is on screen and nobody is pointing at it, the two flows replay in turn.
  const [mapRef, inView] = useInView<HTMLElement>()
  const [tour, setTour] = useState(true)
  const touring = tour && inView && !reduced && !hover && !pinned && !focused
  useEffect(() => {
    if (!touring) return
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const step = () => {
      const demo = DEMOS[i++ % DEMOS.length]!
      launch(demo.hops)
      t = setTimeout(step, spanOf(demo.hops) + 1400)
    }
    t = setTimeout(step, 500)
    return () => clearTimeout(t)
  }, [touring, launch])

  // Real traffic: every frame recorded after this page opened sends a packet along its wires.
  const frames = useTraffic((s) => s.frames)
  const seen = useRef<number>(frames[0]?.id ?? 0)
  useEffect(() => {
    const fresh = frames.filter((f) => f.id > seen.current)
    if (fresh.length === 0) return
    seen.current = frames[0]!.id
    // Bursts of refetches would flood the map; animate at most two per burst.
    for (const f of fresh.slice(0, 2).reverse()) launch(tripFor(f, side))
  }, [frames, side, launch])

  const related = active ? neighbours(active) : null
  const activeLinks = active ? new Set(linksOf(active)) : null
  const busy = new Set(trips.flatMap((t) => t.hops.map((h) => h.link)))

  const nodeProps = (id: NodeId) => ({
    tabIndex: 0,
    role: 'button' as const,
    'aria-label': NODES[id].title,
    'aria-pressed': pinned === id,
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
    onFocus: () => setFocused(id),
    onBlur: () => setFocused(null),
    onClick: () => setPinned((p) => (p === id ? null : id)),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setPinned((p) => (p === id ? null : id))
      } else if (e.key === 'Escape') setPinned(null)
    },
    className: cn('cursor-pointer outline-none transition-opacity duration-200', related && !related.has(id) && 'opacity-30'),
  })

  return (
    <DiagramFrame
      ref={mapRef}
      label="System map"
      minWidth={820}
      toolbar={
        <>
          {DEMOS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => launch(d.hops)}
              className="pressable inline-flex h-8 items-center rounded-full bg-bg-muted px-3.5 text-13 font-medium transition-colors duration-150 hover:bg-bg-active"
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTour((v) => !v)}
            aria-pressed={!tour}
            aria-label={tour ? 'Pause the automatic replay' : 'Resume the automatic replay'}
            className="pressable inline-flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-bg-muted hover:text-text [&_svg]:size-4"
          >
            {tour ? <Pause aria-hidden /> : <Play aria-hidden />}
          </button>
          <span className="ms-auto">
            <SocketStatus />
          </span>
        </>
      }
      footer={<MapFooter active={active} side={side} />}
    >
      <svg viewBox="0 0 1100 560" className="h-auto w-full" aria-label="System map: devices, proxy, server, database and model">
        <Arrowheads />

        {/* the server's outline sits under the wires, so every wire reaches its box */}
        <rect x={570} y={30} width={290} height={500} rx={24} className="fill-bg-subtle stroke-border-strong" strokeDasharray="5 5" />
        <text x={590} y={58} className="fill-text text-[13px] font-semibold">
          Rust server (Axum, one process)
        </text>

        {/* links first, so packets and nodes draw over them */}
        {(Object.keys(LINKS) as LinkId[]).map((id) => {
          const l = LINKS[id]
          const dim = activeLinks && !activeLinks.has(id)
          const lit = (activeLinks?.has(id) ?? false) || (reduced && busy.has(id))
          return (
            <g key={id} className={cn('transition-opacity duration-200', dim && 'opacity-15')}>
              <path
                d={l.d}
                fill="none"
                strokeWidth={lit ? 2.75 : 1.75}
                markerEnd={`url(#ah-${l.kind})`}
                markerStart={l.both ? `url(#ah-${l.kind})` : undefined}
                {...strokeFor(l.kind)}
              />
              {l.label && (
                <text
                  x={l.label[1]}
                  y={l.label[2]}
                  textAnchor={l.label[3] ?? 'middle'}
                  className="fill-text-secondary text-[11px] font-medium"
                >
                  {l.label[0]}
                </text>
              )}
            </g>
          )
        })}

        {/* devices */}
        <g {...nodeProps('a')}>
          <rect x={20} y={60} width={220} height={150} rx={20} className="fill-hue-blue-pale" />
          <image href="/avatars/alice.webp" x={38} y={78} width={40} height={40} style={{ clipPath: 'inset(0 round 20px)' }} />
          <text x={90} y={96} className="fill-text text-[13px] font-semibold">
            Device A · laptop
          </text>
          <text x={90} y={113} className="fill-text-secondary text-[11.5px]">
            Alice, operator
          </text>
          <DeviceLines y={150} lines={['React app in a browser', 'Access token in memory', 'One WebSocket while open']} />
          {side === 'a' && <YouTag x={240} y={60} />}
        </g>
        <g {...nodeProps('b')}>
          <rect x={20} y={350} width={220} height={150} rx={20} className="fill-hue-gold-pale" />
          <image href="/avatars/bob.webp" x={38} y={368} width={40} height={40} style={{ clipPath: 'inset(0 round 20px)' }} />
          <text x={90} y={386} className="fill-text text-[13px] font-semibold">
            Device B · phone
          </text>
          <text x={90} y={403} className="fill-text-secondary text-[11.5px]">
            Bob, reviewer
          </text>
          <DeviceLines y={440} lines={['Same app, mobile layout', 'Different machine, same Wi-Fi', 'Never talks to Device A']} />
          {side === 'b' && <YouTag x={240} y={350} />}
        </g>

        <g {...nodeProps('caddy')}>
          <Box
            x={330}
            y={210}
            w={170}
            h={140}
            title="Caddy"
            lines={['Reverse proxy, :8080', 'Serves the web app', '/api → REST', '/ws → WebSocket']}
            tone="muted"
          />
        </g>

        <g {...nodeProps('rest')}>
          <Box x={590} y={76} w={250} h={86} title="REST API" lines={['Accounts, users, history', 'Cases, runs, approvals, audit']} />
        </g>
        <g {...nodeProps('auth')}>
          <Box x={590} y={174} w={250} h={86} title="Auth" lines={['Argon2id passwords, JWT access', 'Refresh cookie, 30 s WS ticket']} />
        </g>
        <g {...nodeProps('hub')}>
          <Box
            x={590}
            y={272}
            w={250}
            h={86}
            title="WebSocket hub · Realtime Relay"
            lines={['Who is online, on which sockets', 'Push: message, typing, run, approval']}
          />
        </g>
        <g {...nodeProps('worker')}>
          <Box
            x={590}
            y={370}
            w={250}
            h={140}
            title="Agent worker"
            lines={[
              'Run Orchestrator: state machine',
              'Invoice Risk Analyst: model call',
              'Approval Gatekeeper: human gate',
              'Case Action Executor: runs once',
            ]}
            tone="ink"
          />
        </g>

        <g {...nodeProps('db')}>
          <ellipse cx={1000} cy={120} rx={78} ry={16} className="fill-hue-green-pale stroke-hue-green" strokeWidth={1.5} />
          <path d="M922 120v110c0 9 35 16 78 16s78-7 78-16V120" className="fill-hue-green-pale stroke-hue-green" strokeWidth={1.5} />
          <text x={1000} y={170} textAnchor="middle" className="fill-text text-[13px] font-semibold">
            PostgreSQL
          </text>
          <text x={1000} y={188} textAnchor="middle" className="fill-text-secondary text-[11.5px]">
            users, messages, cases,
          </text>
          <text x={1000} y={205} textAnchor="middle" className="fill-text-secondary text-[11.5px]">
            runs, approvals, audit
          </text>
        </g>
        <g {...nodeProps('llm')}>
          <Box
            x={922}
            y={390}
            w={160}
            h={104}
            title="Language model"
            lines={['Mock (default) or', 'LM Studio, OpenAI-', 'compatible, local']}
            tone="muted"
          />
        </g>

        {/* keyboard focus ring, drawn on top */}
        {focused && <FocusRing box={NODES[focused].box} />}

        {/* packets */}
        {!reduced && trips.flatMap((t) => t.hops.map((h, i) => <Packet key={`${t.id}-${i}`} hop={h} />))}
      </svg>
    </DiagramFrame>
  )
}

/* ------------------------------------------------------------------ pieces */

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
    <>
      <rect x={x} y={y} width={w} height={h} rx={16} className={cn(fill, tone === 'surface' && 'stroke-border')} strokeWidth={1} />
      <text x={x + 16} y={y + 26} className={cn(text, 'text-[13px] font-semibold')}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 16} y={y + 46 + i * 17} className={cn(sub, 'text-[11.5px]')}>
          {l}
        </text>
      ))}
    </>
  )
}

function DeviceLines({ y, lines }: { y: number; lines: string[] }) {
  return lines.map((l, i) => (
    <text key={l} x={38} y={y + i * 17} className="fill-text-secondary text-[11.5px]">
      {l}
    </text>
  ))
}

function YouTag({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 46} y={y - 11} width={40} height={22} rx={11} className="fill-ink" />
      <text x={x - 26} y={y + 4} textAnchor="middle" className="fill-text-on-ink text-[11px] font-semibold">
        You
      </text>
    </g>
  )
}

function FocusRing({ box: [x, y, w, h] }: { box: [number, number, number, number] }) {
  return (
    <rect
      x={x - 5}
      y={y - 5}
      width={w + 10}
      height={h + 10}
      rx={22}
      fill="none"
      className="stroke-focus"
      strokeWidth={2.5}
      pointerEvents="none"
    />
  )
}

/** One dot running along one wire, measured from the wire's own path. */
function Packet({ hop }: { hop: Hop }) {
  const ref = useRef<SVGCircleElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', LINKS[hop.link].d)
    const len = path.getTotalLength()
    const start = performance.now() + hop.at * HOP_MS
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / HOP_MS))
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
      const pt = path.getPointAtLength((hop.reverse ? 1 - e : e) * len)
      el.setAttribute('cx', String(pt.x))
      el.setAttribute('cy', String(pt.y))
      el.style.opacity = now < start || p >= 1 ? '0' : '1'
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hop])
  return (
    <circle
      ref={ref}
      r={6}
      className={cn(PACKET_FILL[LINKS[hop.link].kind], 'stroke-bg-surface')}
      strokeWidth={2.5}
      style={{ opacity: 0 }}
      pointerEvents="none"
    />
  )
}

const STATUS_TEXT = {
  connected: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  idle: 'Not connected',
} as const

function SocketStatus() {
  const status = useRealtimeStore((s) => s.wsStatus)
  const live = status === 'connected'
  return (
    <span className="inline-flex items-center gap-2 text-13 text-text-secondary">
      <span
        className={cn('size-2 rounded-full', live ? 'bg-success-solid' : status === 'offline' ? 'bg-danger-solid' : 'bg-warning-solid')}
        aria-hidden
      />
      Your socket: {STATUS_TEXT[status]}
    </span>
  )
}

function MapFooter({ active, side }: { active: NodeId | null; side: 'a' | 'b' }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-h-24">
        {active ? (
          <>
            <p className="text-sm font-semibold">
              {NODES[active].title}
              {active === side && <span className="ms-2 text-13 font-normal text-text-secondary">this is you</span>}
            </p>
            <p className="mt-1 max-w-prose text-13 text-pretty text-text-secondary">{NODES[active].text}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">Point at any part</p>
            <p className="mt-1 max-w-prose text-13 text-pretty text-text-secondary">
              Hover, tap or tab to a box to see what it does and which wires it uses. Dots on the wires are this browser’s real requests and
              pushes, as they happen.
            </p>
          </>
        )}
        <div className="mt-4">
          <Legend
            items={[
              { label: 'REST: ask, get an answer', kind: 'rest' },
              { label: 'WebSocket: the server pushes', kind: 'ws' },
              { label: 'SQL', kind: 'sql' },
              { label: 'Model call', kind: 'llm' },
            ]}
          />
        </div>
      </div>
      <div className="space-y-4">
        <OnlineNow />
        <TrafficLog />
      </div>
    </div>
  )
}

function OnlineNow() {
  const { data: users } = useUsers()
  const online = (users ?? []).filter((u) => u.online)
  return (
    <div>
      <p className="text-xs font-medium text-text-tertiary">Online now</p>
      <div className="mt-1.5 flex min-h-7 items-center gap-2">
        {online.length === 0 ? (
          <span className="text-13 text-text-secondary">Nobody else yet. Sign in as Bob in another window.</span>
        ) : (
          <>
            <span className="flex -space-x-1.5">
              {online.slice(0, 5).map((u) => (
                <UserAvatar key={u.id} username={u.username} size="sm" className="rounded-full ring-2 ring-bg-subtle" dotTestId={false} />
              ))}
            </span>
            <span className="text-13 text-text-secondary">{online.map((u) => u.username).join(', ')}</span>
          </>
        )}
      </div>
    </div>
  )
}

function TrafficLog() {
  const frames = useTraffic((s) => s.frames)
  const now = useNow()
  return (
    <div>
      <p className="text-xs font-medium text-text-tertiary">This browser, live</p>
      <ol role="log" aria-live="off" aria-label="Recent requests and pushes" className="mt-1.5 space-y-1">
        {frames.length === 0 && <li className="text-13 text-text-secondary">Nothing yet. Send a message or open a page.</li>}
        {frames.slice(0, 5).map((f) => (
          <li key={f.id} className="animate-row-in flex items-center gap-2 text-13">
            <Chip channel={f.channel} />
            <span className="w-3 text-text-tertiary" aria-label={f.dir === 'out' ? 'sent' : 'received'}>
              {f.dir === 'out' ? '↑' : '↓'}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={f.label}>
              {f.label}
              {f.detail && <span className="text-text-tertiary"> {f.detail}</span>}
            </span>
            <span className="shrink-0 text-xs text-text-tertiary tabular-nums">{age(f.at, now)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Chip({ channel }: { channel: 'rest' | 'ws' }): ReactNode {
  return channel === 'rest' ? (
    <span className="inline-flex h-5 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-[10.5px] font-medium text-text-on-ink">
      REST
    </span>
  ) : (
    <span className="inline-flex h-5 w-11 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[10.5px] font-medium text-accent-text">
      WS
    </span>
  )
}
