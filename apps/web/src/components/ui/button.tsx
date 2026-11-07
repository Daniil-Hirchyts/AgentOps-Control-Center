import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'pressable inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium whitespace-nowrap select-none',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** The one filled action per view. */
        primary: 'bg-ink text-text-on-ink hover:bg-ink-hover',
        secondary: 'border border-transparent bg-bg-muted text-text hover:bg-bg-active',
        ghost: 'text-text-secondary hover:bg-bg-muted hover:text-text',
        /** Destructive confirmation inside a dialog. */
        danger: 'bg-danger-solid text-white hover:opacity-90',
        /** Outline-ish destructive trigger that does not compete with the primary action. */
        'danger-soft': 'border border-transparent bg-danger-subtle text-danger-text hover:bg-danger-border/40',
        link: 'h-auto px-0 text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-13 has-[>svg:first-child]:ps-2.5',
        md: 'h-9 px-4 has-[>svg:first-child]:ps-3.5',
        lg: 'h-11 px-5 text-sm has-[>svg:first-child]:ps-4',
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
