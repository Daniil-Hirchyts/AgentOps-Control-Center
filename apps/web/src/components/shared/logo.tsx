import { cn } from '@/lib/utils'

/**
 * The AgentOps mark: a loop with one opening, and a gold checkpoint sitting in it.
 * Work goes round the loop; nothing passes the opening without the human (the dot).
 * Geometry is shared with public/favicon.svg, keep the two in step.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <path
        d="M24.49 16.44 A8.5 8.5 0 1 1 15.56 7.51"
        fill="none"
        strokeWidth="3.2"
        strokeLinecap="round"
        className="stroke-bg"
      />
      <circle cx="22.01" cy="9.99" r="3.2" className="fill-hue-gold" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-text', className)}>
      <LogoMark />
      AgentOps
    </span>
  )
}
