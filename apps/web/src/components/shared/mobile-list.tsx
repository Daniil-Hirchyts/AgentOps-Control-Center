import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Phone replacement for a table: one stacked row per item, shown below `sm` while the table is hidden.
 * Bleeds to the screen edges so the dividers and the pressed state run full width.
 */
export function MobileList({ children, className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul className={cn('-mx-4 divide-y divide-separator border-y border-separator sm:hidden', className)} {...props}>
      {children}
    </ul>
  )
}

/**
 * `title` usually holds a RowLink, whose hit area covers the whole row.
 * `trailing` sits on the title line (an amount), `meta` on the line below (status, time).
 */
export function MobileListItem({
  title,
  trailing,
  meta,
  className,
  ...props
}: {
  title: ReactNode
  trailing?: ReactNode
  meta?: ReactNode
} & Omit<React.ComponentProps<'li'>, 'title'>) {
  return (
    <li className={cn('relative px-4 py-3 transition-colors duration-150 active:bg-bg-muted', className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-text">{title}</div>
        {trailing && <div className="shrink-0 text-sm text-text tabular-nums">{trailing}</div>}
      </div>
      {meta && (
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-13 text-text-secondary">{meta}</div>
      )}
    </li>
  )
}
