/** Non-component helpers for the Learn diagrams: line styles, motion hooks, the step player. */
import { useEffect, useEffectEvent, useState } from 'react'
import { useMediaQuery } from '@/lib/hooks'

export type Kind = 'rest' | 'ws' | 'sql' | 'llm' | 'internal'

export function strokeFor(kind: Kind) {
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

export const PACKET_FILL: Record<Kind, string> = {
  rest: 'fill-ink',
  ws: 'fill-accent-solid',
  sql: 'fill-hue-green',
  llm: 'fill-hue-purple',
  internal: 'fill-text-tertiary',
}

export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** True while at least `threshold` of the element is on screen. Attach `ref` to the element. */
export function useInView<T extends Element>(threshold = 0.35) {
  const [el, setEl] = useState<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [el, threshold])
  return [setEl, inView] as const
}

/**
 * Steps through `total` frames. `index` -1 means "everything at rest, nothing highlighted".
 *
 * It starts by itself once the diagram is on screen and loops until the reader takes over:
 * pause, step or pick a step and it stays where they left it (Play loops again). Off screen,
 * or while `suspended` (the reader is pointing at a part), it waits. With reduced motion it
 * never starts by itself.
 */
export function usePlayer(total: number, interval = 1700, opts: { suspended?: boolean; onLoop?: (auto: boolean) => void } = {}) {
  const reduced = useReducedMotion()
  const [attach, inView] = useInView<HTMLElement>()
  const [index, setIndex] = useState(-1)
  const [held, setHeld] = useState(false)
  const [wantPlay, setWantPlay] = useState(false)
  const running = inView && !opts.suspended && (held ? wantPlay : !reduced)

  const loopEvent = useEffectEvent((auto: boolean) => opts.onLoop?.(auto))

  useEffect(() => {
    if (!running) return
    const last = index >= total - 1
    // Hold the last step a little longer, so the whole flow can be read before it starts over.
    const t = setTimeout(
      () => {
        if (last) {
          setIndex(0)
          loopEvent(!held)
        } else setIndex(index + 1)
      },
      index < 0 ? 400 : last ? interval * 2 : interval,
    )
    return () => clearTimeout(t)
  }, [running, index, total, interval, held])

  const takeOver = (play: boolean) => {
    setHeld(true)
    setWantPlay(play)
  }

  return {
    /** Callback ref for the diagram frame: playback runs only while it is on screen. */
    attach,
    index,
    playing: running,
    /** Still playing by itself: the reader has not taken over. */
    auto: !held,
    total,
    play: () => takeOver(true),
    pause: () => takeOver(false),
    /** Start from the first step and play, e.g. after picking another path. */
    restart: () => {
      takeOver(true)
      setIndex(-1)
    },
    next: () => {
      takeOver(false)
      setIndex((i) => Math.min(total - 1, i + 1))
    },
    prev: () => {
      takeOver(false)
      setIndex((i) => Math.max(0, i - 1))
    },
    reset: () => {
      takeOver(false)
      setIndex(-1)
    },
    go: (i: number) => {
      takeOver(false)
      setIndex(i)
    },
  }
}

export type Player = ReturnType<typeof usePlayer>

/** 0 → 1 over `duration` ms after `delay`, restarted whenever `key` changes. */
export function useTween(key: unknown, duration: number, delay = 0, enabled = true) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration))
      setT(p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key, duration, delay, enabled])
  return enabled ? t : 1
}

/** Relative age for the live log: "now", "4 s", "2 min". */
export function age(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 2) return 'now'
  if (s < 60) return `${s} s`
  return `${Math.round(s / 60)} min`
}

export function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [every])
  return now
}
