import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'pressable inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap select-none',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** The one filled action per view. */
        primary: 'bg-accent-solid text-accent-contrast hover:bg-accent-solid-hover',
        secondary:
          'border border-transparent bg-surface text-text shadow-elevated hover:bg-bg-subtle',
        ghost: 'text-text-secondary hover:bg-bg-muted hover:text-text',
        /** Destructive confirmation inside a dialog. */
        danger: 'bg-danger-solid text-white hover:opacity-90',
        /** Outline-ish destructive trigger that does not compete with the primary action. */
        'danger-soft': 'border border-transparent bg-surface text-danger shadow-elevated hover:bg-bg-subtle',
        link: 'h-auto px-0 text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-2.5 text-13 has-[>svg:first-child]:pl-2',
        md: 'h-9 px-3.5 has-[>svg:first-child]:pl-3',
        lg: 'h-11 px-5 text-sm has-[>svg:first-child]:pl-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
