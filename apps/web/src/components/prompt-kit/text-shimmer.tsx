/**
 * Text shimmer — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * Used for the agent's live "Analyzing invoice…" state. Under reduced motion the
 * animation runs once and settles (see index.css).
 */
import type * as React from 'react'
import { cn } from '@/lib/utils'

export type TextShimmerProps = {
  as?: React.ElementType
  duration?: number
  spread?: number
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>

export function TextShimmer({
  as: Component = 'span',
  className,
  duration = 3,
  spread = 18,
  children,
  style,
  ...props
}: TextShimmerProps) {
  const s = Math.min(Math.max(spread, 5), 45)
  return (
    <Component
      className={cn('animate-shimmer bg-size-[200%_auto] bg-clip-text font-medium text-transparent', className)}
      style={{
        backgroundImage: `linear-gradient(to right, var(--color-text-tertiary) ${50 - s}%, var(--color-text) 50%, var(--color-text-tertiary) ${50 + s}%)`,
        animationDuration: `${duration}s`,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  )
}
