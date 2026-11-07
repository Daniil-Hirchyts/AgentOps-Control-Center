/**
 * Shared pieces for the Learn diagrams: line styles per channel, arrowheads, the frame,
 * the legend, a player toolbar and the motion helpers.
 * Every diagram is SVG drawn with theme tokens, so it follows light and dark mode.
 */
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'
import { type Kind, PACKET_FILL, type Player, strokeFor } from './model'

export function Arrowheads() {
  return (
    <defs>
      {(Object.keys(PACKET_FILL) as Kind[]).map((k) => (
        <marker
          key={k}
          id={`ah-${k}`}
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          {/* Fixed size: a lit (thicker) wire keeps the same head. */}
          <path d="M0 1 9.5 5 0 9 2 5z" className={PACKET_FILL[k]} />
        </marker>
      ))}
    </defs>
  )
}

/** A figure card. Wide diagrams scroll sideways on phones instead of shrinking their labels. */
export function DiagramFrame({
  children,
  toolbar,
  footer,
  minWidth = 720,
  label,
  className,
  ref,
}: {
  ref?: Ref<HTMLElement>
  children: ReactNode
  toolbar?: ReactNode
  footer?: ReactNode
  minWidth?: number
  label: string
  className?: string
}) {
  return (
    <figure ref={ref} className={cn('surface overflow-hidden rounded-2xl', className)} aria-label={label}>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-separator px-4 py-2.5 sm:px-6">{toolbar}</div>}
      <div className="scrollbar-none overflow-x-auto overscroll-x-contain p-4 sm:p-6">
        <div style={{ minWidth }}>{children}</div>
      </div>
      <p className="-mt-2 px-4 pb-3 text-xs text-text-tertiary md:hidden">Swipe sideways to see the whole diagram.</p>
      {footer && <div className="border-t border-separator bg-bg-subtle px-4 py-4 sm:px-6">{footer}</div>}
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

const iconBtn =
  'pressable inline-flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-bg-muted hover:text-text disabled:opacity-40 disabled:hover:bg-transparent [&_svg]:size-4'

/** Play, pause and step controls. Arrow keys step while the toolbar has focus. */
export function PlayerControls({ player, label }: { player: Omit<Player, 'attach'>; label: string }) {
  const { index, total, playing } = player
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      player.next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      player.prev()
    }
  }
  return (
    <div role="toolbar" aria-label={`${label} controls`} className="flex items-center gap-1" onKeyDown={onKey}>
      <button
        type="button"
        onClick={playing ? player.pause : player.play}
        className="pressable inline-flex h-8 items-center gap-1.5 rounded-full bg-ink ps-2.5 pe-3.5 text-13 font-medium text-text-on-ink transition-colors duration-150 hover:bg-ink-hover [&_svg]:size-3.5"
      >
        {playing ? <Pause aria-hidden fill="currentColor" /> : <Play aria-hidden fill="currentColor" />}
        {playing ? 'Pause' : index >= 0 ? 'Resume' : 'Play'}
      </button>
      <button type="button" onClick={player.prev} disabled={index <= 0} className={iconBtn} aria-label="Previous step">
        <ChevronLeft aria-hidden />
      </button>
      <button type="button" onClick={player.next} disabled={index >= total - 1} className={iconBtn} aria-label="Next step">
        <ChevronRight aria-hidden />
      </button>
      <button type="button" onClick={player.reset} disabled={index < 0} className={iconBtn} aria-label="Show every step">
        <RotateCcw aria-hidden />
      </button>
      <span className="ms-1 text-13 text-text-tertiary tabular-nums" aria-hidden>
        {index < 0 ? `${total} steps` : `${index + 1} / ${total}`}
      </span>
    </div>
  )
}
