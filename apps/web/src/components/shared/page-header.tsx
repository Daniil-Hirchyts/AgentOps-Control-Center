import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-ml-1.5 inline-flex h-8 items-center gap-0.5 rounded-md pr-2 pl-1 text-13 text-text-secondary transition-colors duration-150 hover:text-text"
    >
      <ChevronLeft className="size-4" strokeWidth={1.5} />
      {children}
    </Link>
  )
}

export function PageHeader({
  title,
  meta,
  actions,
  back,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {back && <div className="mb-2">{back}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl sm:tracking-[-0.015em]">{title}</h1>
          {meta && <div className="text-13 text-text-secondary">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** Flat section with a small heading; sections are separated by whitespace, not cards. */
export function Section({
  title,
  aside,
  children,
  className,
  ...props
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
} & Omit<React.ComponentProps<'section'>, 'title'>) {
  return (
    <section className={cn('min-w-0', className)} {...props}>
      {(title || aside) && (
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3 border-b pb-2">
          {title && <h2 className="shrink-0 text-13 font-medium text-text">{title}</h2>}
          {aside && <div className="flex min-w-0 items-center justify-end gap-2 text-13">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Separator dot for inline meta lines. */
export function MetaDot() {
  return (
    <span aria-hidden className="text-text-tertiary">
      ·
    </span>
  )
}
