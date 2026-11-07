/**
 * The agent line — an isometric figure of the run pipeline (Anatomy kit, components/iso).
 *
 * The object is the explanation: an invoice sheet rides a carriage along a rail bench.
 *   intake tray → scanner gantry (model call, cable to the model box) → boom gate opened
 *   only by the reviewer's key switch → stamp press that strikes exactly once → audit
 *   cabinet. A rejected sheet slides off into the reject bin and nothing is stamped.
 *
 * Everything that moves is driven by `pipelineOf(run)` — the same model the 2D track and
 * the overview board read — so the figure can never disagree with the run's status.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Dots, Line, Solid, Wire } from '@/components/iso/draw'
import {
  boxCorners,
  corners,
  cylinder,
  depthOf,
  type Flat,
  fitProjection,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  pathOf,
  type Plan,
  planOutline,
  type Point3,
  type Projection,
  ring,
  segment,
  slabOf,
  topMatrix,
  topTicks,
  translateAlong,
} from '@/components/iso/iso-kit'
import { follow, useLoop, useStillness } from '@/components/iso/live'
import type { AgentRunDto } from '@/lib/types'
import { cn } from '@/lib/utils'
import { currentStage, pipelineOf, type StageId } from './pipeline'

const W = 760
const H = 350
const AZ = 62

/* ---------- world plan (units ≈ px of the real bench, z up) ---------- */

const BASE: Plan = { x: 0, y: 0, w: 304, d: 76, r: 5 }
const STATION_X: Record<StageId, number> = { intake: 34, analyze: 92, review: 146, execute: 222, done: 270 }
const RAIL_Y = [26, 41] as const
const SHEET_TOP = 13.8
const GATE_PIVOT: Point3 = [156, 55, 30]
const GATE_ARM = 49
const STAMP_REST = 26
const STAMP_HIT = SHEET_TOP
const BIN: Plan = { x: 144, y: 2, w: 30, d: 17, r: 1.5 }
const BIN_SHIFT: Point3 = [159 - STATION_X.review, 4 - 24.5, 1.4]

const P: Projection = fitProjection(
  [...boxCorners(BASE, -4, 58), [115, 9, 62]],
  W,
  H,
  { pad: 26, azimuth: AZ },
)

const at = (p: Point3): Flat => iso(p, P)
const byDepth = <T extends [number, number]>(pts: T[]) =>
  [...pts].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P))

/* ---------- static art, built once ---------- */

function BenchArt() {
  const groove = planOutline(insetPlan(BASE, 4.5), 7, P)
  const strip: Plan = { x: 14, y: 66, w: 276, d: 6, r: 1 }
  const ticks = topTicks(16, 288, 4, 5, strip.y + 0.6, 7.6, [2, 3.6], P)
  const label: Plan = { x: 14, y: 50, w: 36, d: 12, r: 1 }
  return (
    <g>
      <path className="iso-halo" d={slabOf(BASE, -4, 11, P).fill} />
      {byDepth(corners(BASE, 12)).map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <Solid paths={cylinder(x, y, 5.5, -4, 1.4, P, 24)} tone="lo" />
          <Solid paths={cylinder(x, y, 4.2, -2.6, 2.6, P, 24)} tone="mid" />
        </g>
      ))}
      <Solid paths={slabOf(BASE, 0, 7, P, 8, 1.4)} tone="mid" />
      <Line d={groove} tone="faint" />
      {corners(BASE, 8).map(([x, y]) => (
        <g key={`s${x}-${y}`}>
          <Line d={ring(x, y, 1.9, 7, P, 16)} tone="lo" />
          <Dots points={[at([x, y, 7])]} size={0.7} tone="mid" />
        </g>
      ))}
      {/* ruler strip: one major tick per station */}
      <Solid paths={slabOf(strip, 7, 0.6, P, 3)} tone="lo" crease="none" />
      <Line d={ticks.minor} tone="lo" />
      <Line d={ticks.major} tone="mid" />
      {Object.values(STATION_X).map((x) => (
        <Line key={x} d={lineOnTop([x, strip.y + 0.6], [x, strip.y + 5.2], 7.6, P)} tone="hi" />
      ))}
      {/* label plate, the one engraved word */}
      <Solid paths={slabOf(label, 7, 0.8, P, 4)} tone="mid" />
      <Line d={planOutline(insetPlan(label, 1.4), 7.8, P)} tone="faint" />
      <text className="iso-face-text" data-tone="mid" transform={topMatrix([17.5, 54.6], 7.8, P)} fontSize={2.6}>
        AGENT LINE
      </text>
      <Line d={lineOnTop([17.5, 57.2], [40, 57.2], 7.8, P)} tone="lo" free />
      <Line d={lineOnTop([17.5, 59.2], [33, 59.2], 7.8, P)} tone="lo" free />
      <Dots points={[at([46.5, 53.5, 7.8]), at([46.5, 58.5, 7.8])]} size={0.55} tone="mid" />
    </g>
  )
}

/** Stations behind the rail (small y): drawn before the carriage. */
function BackArt({ queued }: { queued: boolean }) {
  const tray: Plan = { x: 18, y: 4, w: 30, d: 18, r: 1.5 }
  const box: Plan = { x: 104, y: 3, w: 22, d: 13, r: 1.5 }
  const cabinet: Plan = { x: 254, y: 3, w: 38, d: 22, r: 1.5 }
  const vents = [7, 9.5, 12].map((y) => lineOnTop([108, y], [122, y], 24, P))
  return (
    <g>
      {/* intake tray with the queue of sheets */}
      <Solid paths={slabOf(tray, 7, 2, P, 6, 0.4)} tone="mid" />
      <Solid paths={slabOf({ x: 18, y: 4, w: 30, d: 2, r: 0.6 }, 9, 7, P, 4)} tone="mid" />
      <Solid paths={slabOf({ x: 18, y: 6, w: 2, d: 16, r: 0.6 }, 9, 4, P, 4)} tone="mid" />
      {[0, 1, 2].slice(queued ? 0 : 1).map((i) => (
        <Solid
          key={i}
          paths={slabOf({ x: 23 + i * 0.6, y: 7.5 - i * 0.4, w: 21, d: 12.5, r: 0.5 }, 9 + i * 0.9, 0.8, P, 3)}
          tone="hi"
          crease="none"
        />
      ))}
      <Solid paths={slabOf({ x: 46, y: 6, w: 2, d: 16, r: 0.6 }, 9, 4, P, 4)} tone="mid" />

      {/* gantry: back post and its foot */}
      <Solid paths={slabOf({ x: 86, y: 9, w: 12, d: 12, r: 1 }, 7, 1.5, P, 4)} tone="lo" />
      <Solid paths={slabOf({ x: 89, y: 12, w: 6, d: 6, r: 1 }, 8.5, 39.5, P, 4, 0.4)} tone="mid" />

      {/* model box: vents on top, status LED on its face */}
      <Solid paths={slabOf(box, 7, 17, P, 6, 0.6)} tone="mid" />
      {vents.map((d, i) => (
        <Line key={i} d={d} tone="lo" />
      ))}
      <Dots points={[at([106.5, 5.5, 24]), at([123.5, 5.5, 24]), at([106.5, 13.5, 24]), at([123.5, 13.5, 24])]} size={0.5} tone="mid" />

      {/* reject bin, open top */}
      <Solid paths={slabOf(BIN, 7, 10, P, 6, 0.4)} tone="mid" />
      <Line d={planOutline(insetPlan(BIN, 1.6), 17, P)} tone="lo" />

      {/* press column on its foot */}
      <Solid paths={slabOf({ x: 212, y: 1, w: 20, d: 16, r: 1.5 }, 7, 2, P, 6, 0.4)} tone="lo" />
      <Solid paths={slabOf({ x: 216, y: 3, w: 12, d: 12, r: 1.5 }, 9, 49, P, 6, 0.5)} tone="mid" />
      <Dots points={[at([214, 3, 9]), at([230, 3, 9]), at([214, 15, 9]), at([230, 15, 9])]} size={0.55} tone="mid" />

      {/* audit cabinet: three drawers on the face toward the rail */}
      <Solid
        paths={slabOf(cabinet, 7, 33, P, 6, 0.6)}
        tone="mid"
        inner={
          <>
            {[17.5, 28].map((z) => (
              <Line key={z} d={segment([254.2, 25, z], [292, 25, z], P)} tone="lo" />
            ))}
            {[12.2, 22.7, 33.4].map((z) => (
              <Line key={`h${z}`} d={segment([268, 25, z], [278, 25, z], P)} tone="hi" />
            ))}
          </>
        }
      />
      <Solid paths={slabOf({ x: 260, y: 7, w: 26, d: 14, r: 1 }, 40, 1.6, P, 4)} tone="mid" />
      <Solid paths={slabOf({ x: 263, y: 9, w: 20, d: 10, r: 0.5 }, 41.6, 0.8, P, 3)} tone="hi" crease="none" />
    </g>
  )
}

function RailArt() {
  return (
    <g>
      <Solid paths={slabOf({ x: 7, y: 23, w: 5, d: 24, r: 0.8 }, 7, 7, P, 4, 0.4)} tone="mid" />
      {RAIL_Y.map((y) => (
        <g key={y}>
          <Solid paths={slabOf({ x: 12, y, w: 280, d: 3, r: 0.6 }, 7, 3, P, 3, 0.3)} tone="mid" />
          <Dots points={Array.from({ length: 14 }, (_, i) => at([20 + i * 20, y + 1.5, 10]))} size={0.45} tone="lo" />
        </g>
      ))}
      <Solid paths={slabOf({ x: 292, y: 23, w: 5, d: 24, r: 0.8 }, 7, 7, P, 4, 0.4)} tone="mid" />
    </g>
  )
}

function Sheet({ cx, stamped }: { cx: number; stamped: boolean }) {
  const plan: Plan = { x: cx - 9, y: 24.5, w: 18, d: 21, r: 0.6 }
  const z = SHEET_TOP
  return (
    <>
      <Solid paths={slabOf(plan, z - 0.8, 0.8, P, 3)} tone="hi" lit crease="none" />
      <Line d={lineOnTop([cx - 6.5, 27.5], [cx + 1, 27.5], z, P)} tone="mid" free />
      {[31, 33.5, 36, 38.5].map((y, i) => (
        <Line key={y} d={lineOnTop([cx - 6.5, y], [cx + (i % 2 ? 2.5 : 5.5), y], z, P)} tone="lo" free />
      ))}
      <Line d={lineOnTop([cx + 1.5, 42.5], [cx + 6.5, 42.5], z, P)} tone="hi" free />
      {stamped && (
        <g data-testid="machine-stamp">
          <Line d={ring(cx - 2, 41, 3.4, z, P, 28)} tone="lit" />
          <Line d={ring(cx - 2, 41, 2.3, z, P, 24)} tone="lit" />
        </g>
      )}
    </>
  )
}

function Carriage({ cx, sheet }: { cx: number; sheet: ReactNode }) {
  return (
    <g>
      <Solid paths={slabOf({ x: cx - 12, y: 23, w: 24, d: 24, r: 2 }, 10, 3, P, 6, 0.5)} tone="mid" />
      <Dots
        points={[at([cx - 9.5, 25.5, 13]), at([cx + 9.5, 25.5, 13]), at([cx - 9.5, 44.5, 13]), at([cx + 9.5, 44.5, 13])]}
        size={0.6}
        tone="mid"
      />
      {sheet}
    </g>
  )
}

function boomPaths(angle: number) {
  const [px, py, pz] = GATE_PIVOT
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const along = (t: number): Point3 => [px, py - t * GATE_ARM * c, pz + t * GATE_ARM * s]
  const arm = pathOf([at(along(0)), at(along(1))])
  const stripes: string[] = []
  for (let i = 1; i < 8; i += 2) stripes.push(pathOf([at(along(i / 8)), at(along((i + 1) / 8))]))
  const weight = pathOf([at([px, py + 3 * c, pz - 3 * s]), at([px, py + 8 * c, pz - 8 * s])])
  return { arm, stripes: stripes.join(''), weight, tip: at(along(1)) }
}

/* ---------- live figure ---------- */

type RunLike = Pick<AgentRunDto, 'id' | 'status' | 'output' | 'approval' | 'error'>

interface Targets {
  x: number
  gate: number
  bin: number
  stamped: boolean
}

function targetsOf(run: RunLike): Targets {
  const stage = currentStage(run)
  const stages = pipelineOf(run)
  const review = stages.find((s) => s.id === 'review')!
  const rejected = review.state === 'stopped'
  const passed = review.state === 'done'
  const execDone = stages.find((s) => s.id === 'execute')!.state === 'done'
  const x = rejected ? STATION_X.review : run.status === 'COMPLETED' && !execDone ? STATION_X.done : STATION_X[stage]
  return { x, gate: passed ? 1.32 : 0, bin: rejected ? 1 : 0, stamped: execDone }
}

export function PipelineMachine({ run, className }: { run: RunLike; className?: string }) {
  const still = useStillness()
  const target = useMemo(() => targetsOf(run), [run])
  const first = useRef(true)
  const [x, setX] = useState(target.x)
  const [gate, setGate] = useState(target.gate)
  const [bin, setBin] = useState(target.bin)
  const [stamp, setStamp] = useState(STAMP_REST)
  const [strike, setStrike] = useState<number | null>(null)
  const wasStamped = useRef(target.stamped)

  // A newly completed execution strikes the press once (the action ran exactly once).
  useEffect(() => {
    if (first.current) {
      first.current = false
      wasStamped.current = target.stamped
      return
    }
    if (target.stamped && !wasStamped.current) setStrike(0)
    wasStamped.current = target.stamped
  }, [target.stamped])

  const moving = x !== target.x || gate !== target.gate || bin !== target.bin || strike !== null
  useLoop((dt, calm) => {
    const c = calm || still
    setX((v) => follow(v, target.x, dt, 0.45, c))
    setGate((v) => follow(v, target.gate, dt, 0.35, c))
    setBin((v) => follow(v, target.bin, dt, 0.3, c))
    if (strike !== null) {
      // strike: wait for the carriage, then down fast, up slow
      const arrived = Math.abs(x - STATION_X.execute) < 1.5 || Math.abs(x - target.x) < 1.5
      if (arrived || c) {
        const t = strike + dt
        const down = Math.min(1, t / 0.18)
        const up = Math.max(0, Math.min(1, (t - 0.32) / 0.5))
        const depth = c ? 0 : down * (1 - up)
        setStamp(STAMP_REST - (STAMP_REST - STAMP_HIT) * depth)
        if (t > 0.82 || c) {
          setStrike(null)
          setStamp(STAMP_REST)
        } else setStrike(t)
      }
    }
    return true
  }, moving)

  const stages = pipelineOf(run)
  const stage = currentStage(run)
  const analyzing = stages.find((s) => s.id === 'analyze')!.state === 'active'
  const failed = stages.find((s) => s.id === 'analyze')!.state === 'failed'
  const waiting = stages.find((s) => s.id === 'review')!.state === 'waiting'
  const queued = stage === 'intake'
  const boom = boomPaths(gate)
  const binT = Math.min(1, bin)
  const sheetInBin = binT > 0.55
  const shift = translateAlong(P, [BIN_SHIFT[0] * binT, BIN_SHIFT[1] * binT, BIN_SHIFT[2] * binT])

  const back = useMemo(() => <BackArt queued={queued} />, [queued])
  const bench = useMemo(() => <BenchArt />, [])
  const rails = useMemo(() => <RailArt />, [])

  const sheet = <Sheet cx={x} stamped={target.stamped && strike === null} />
  const ledFace = at([118, 16, 19])
  const scan = analyzing ? lineOnTop([92, 24.5], [92, 45.5], SHEET_TOP + 0.05, P) : ''

  return (
    <div className={cn('iso', className)} data-testid="pipeline-machine" data-stage={stage}>
      <svg
        className="iso-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Agent line: the invoice is at ${stages.find((s) => s.id === stage)?.label ?? stage}`}
        focusable="false"
      >
        {bench}
        {back}
        {/* cable: gantry beam → model box, flowing while the model is called */}
        <Wire
          from={at([92, 12, 53])}
          via={[at([92, 12, 60]), at([115, 9.5, 60])]}
          to={at([115, 9.5, 24])}
          tone={analyzing ? 'lit' : 'lo'}
          flow={analyzing && !still}
        />
        <Dots points={[ledFace]} size={1.1} tone={analyzing || failed ? 'hi' : 'faint'} pulse={analyzing && !still} />
        {failed && <circle cx={ledFace[0]} cy={ledFace[1]} r={1.3} fill="var(--anatomy-red)" />}

        {/* rejected sheet, once it has dropped into the bin */}
        {sheetInBin && <g transform={shift}>{sheet}</g>}

        {rails}
        <Carriage cx={x} sheet={sheetInBin ? null : binT > 0 ? <g transform={shift}>{sheet}</g> : sheet} />

        {/* overhead: scanner gantry */}
        <Solid paths={slabOf({ x: 86, y: 47, w: 12, d: 12, r: 1 }, 7, 1.5, P, 4)} tone="lo" />
        <Solid paths={slabOf({ x: 89, y: 50, w: 6, d: 6, r: 1 }, 8.5, 39.5, P, 4, 0.4)} tone="mid" />
        <Solid paths={slabOf({ x: 88, y: 10, w: 8, d: 48, r: 1 }, 48, 5, P, 4, 0.5)} tone="mid" />
        <Solid paths={slabOf({ x: 86, y: 28, w: 12, d: 12, r: 1.5 }, 37, 11, P, 6, 0.5)} tone="mid" />
        <Solid paths={cylinder(92, 34, 3.4, 32, 5, P, 28, 0.3)} tone="hi" lit={analyzing} />
        {scan && <Line d={scan} tone="lit" flow={!still} />}
        {analyzing && <Line d={segment([92, 34, 32], [92, 34, SHEET_TOP + 0.4], P)} tone="lit" dotted />}

        {/* overhead: stamp press arm, ram and head */}
        <Solid paths={slabOf({ x: 218, y: 6, w: 8, d: 31, r: 1 }, 52, 6, P, 4, 0.5)} tone="mid" />
        <Solid paths={cylinder(222, 33, 3.8, 44, 8, P, 28, 0.4)} tone="mid" />
        <Solid paths={cylinder(222, 33, 1.4, stamp + 4, 44 - (stamp + 4), P, 16)} tone="mid" />
        <Solid paths={cylinder(222, 33, 6, stamp, 4, P, 32, 0.5)} tone="hi" lit={strike !== null} />
        <Line d={knurl(222, 33, 6, stamp, stamp + 4, 36, P)} tone="faint" />

        {/* boom gate: arm behind the post, opened only by the key switch */}
        <path className="iso-line" data-tone="hi" d={boom.arm} style={{ strokeWidth: 4.4 }} />
        <path className="iso-line" d={boom.arm} style={{ strokeWidth: 3, stroke: 'var(--anatomy-face)' }} />
        <path className="iso-line" data-tone={waiting ? 'lit' : 'mid'} d={boom.stripes} style={{ strokeWidth: 3, strokeLinecap: 'butt' }} />
        <path className="iso-line" data-tone="hi" d={boom.weight} style={{ strokeWidth: 6.2, strokeLinecap: "butt" }} />
        <path className="iso-line" d={boom.weight} style={{ strokeWidth: 4.6, strokeLinecap: "butt", stroke: "var(--anatomy-shade-1)" }} />
        <Solid paths={slabOf({ x: 153, y: 49, w: 12, d: 12, r: 1 }, 7, 1.5, P, 4)} tone="lo" />
        <Solid paths={slabOf({ x: 157, y: 52, w: 6, d: 6, r: 1 }, 8.5, 24, P, 4, 0.4)} tone="mid" />
        <Dots points={[at(GATE_PIVOT)]} size={1.3} tone="hi" />
        <Solid paths={cylinder(160, 55, 2.3, 32.5, 3.2, P, 24, 0.3)} tone="hi" lit={waiting} />
        {/* key switch: the reviewer's decision, wired to the gate post */}
        <Wire from={at([171, 60, 9])} via={[at([166, 60, 7.4])]} to={at([163, 57, 8.5])} tone="lo" size={0.9} />
        <Solid paths={slabOf({ x: 170, y: 57, w: 14, d: 12, r: 1.5 }, 7, 10, P, 6, 0.5)} tone="mid" />
        <Solid paths={cylinder(177, 63, 2.6, 17, 1.6, P, 24, 0.3)} tone="hi" lit={waiting} />
        <Line d={knurl(177, 63, 2.6, 17, 18.6, 24, P)} tone="faint" />
        <Line d={lineOnTop([175.8, 63 + 1.2 * Math.sin(gate), 18.6].slice(0, 2) as [number, number], [178.2, 63 - 1.2 * Math.sin(gate)], 18.6, P)} tone="hi" />
        <Dots points={[at([172, 59, 17]), at([182, 59, 17]), at([172, 67, 17]), at([182, 67, 17])]} size={0.5} tone="mid" />

        {/* carriage indicator on the ruler */}
        <Dots points={[at([x, 69, 7.7])]} size={1.4} tone="hi" />
      </svg>
    </div>
  )
}
