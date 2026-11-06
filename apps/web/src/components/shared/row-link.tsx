import { Link, type LinkComponentProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

/**
 * A real <a> whose hit area stretches over its whole (position: relative) row.
 * Use inside a <tr className={rowLinkClass}> so the row is navigable without a clickable <tr>.
 */
export function RowLink({ className, ...props }: LinkComponentProps<'a'>) {
  return (
    <Link
      className={cn(
        'outline-none after:absolute after:inset-0 after:content-[""] focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring',
        className,
      )}
      {...props}
    />
  )
}

export const rowLinkClass = 'relative transition-colors duration-100 hover:bg-bg-subtle'
