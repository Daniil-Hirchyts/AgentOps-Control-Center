/**
 * System message — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * A banner for what the system is doing or waiting on ("Waiting for bob", "Nothing executed").
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const variants = cva('flex items-start gap-3 rounded-lg px-3 py-2.5 text-13 leading-normal', {
  variants: {
    variant: {
      action: 'bg-bg-muted text-text-secondary',
      accent: 'bg-accent-subtle text-accent-text',
      warning: 'bg-warning-subtle text-warning-text',
      error: 'bg-danger-subtle text-danger-text',
      success: 'bg-success-subtle text-success-text',
    },
  },
  defaultVariants: { variant: 'action' },
})

const ICON = {
  action: Info,
  accent: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  success: Info,
} as const

export type SystemMessageProps = React.ComponentProps<'div'> &
  VariantProps<typeof variants> & {
    icon?: React.ReactNode
    isIconHidden?: boolean
    action?: React.ReactNode
  }

export function SystemMessage({
  children,
  variant = 'action',
  icon,
  isIconHidden = false,
  action,
  className,
  ...props
}: SystemMessageProps) {
  const Icon = ICON[variant ?? 'action']
  return (
    <div className={cn(variants({ variant }), className)} {...props}>
      {!isIconHidden && (
        <span className="flex h-[1lh] shrink-0 items-center [&_svg]:size-4" aria-hidden>
          {icon ?? <Icon strokeWidth={1.75} />}
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  )
}
