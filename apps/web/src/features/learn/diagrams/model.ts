/** Non-component helpers for the Learn diagrams: line styles, motion hooks, the step player. */
import { useEffect, useState } from 'react'
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

/** Steps through `total` frames. `index` -1 means "everything at rest, nothing highlighted". */
export function usePlayer(total: number, interval = 1700) {
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (index >= total - 1) setPlaying(false)
      else setIndex(index + 1)
    }, index < 0 ? 0 : interval)
    return () => clearTimeout(t)
  }, [playing, index, total, interval])

  return {
    index,
    playing,
    total,
    play: () => {
      if (index >= total - 1) setIndex(-1)
      setPlaying(true)
    },
    pause: () => setPlaying(false),
    next: () => {
      setPlaying(false)
      setIndex((i) => Math.min(total - 1, i + 1))
    },
    prev: () => {
      setPlaying(false)
      setIndex((i) => Math.max(0, i - 1))
    },
    reset: () => {
      setPlaying(false)
      setIndex(-1)
    },
    go: (i: number) => {
      setPlaying(false)
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
