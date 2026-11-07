import * as React from 'react'
import { cn } from '@/lib/utils'

/** Field chrome shared by inputs, textareas and selects. 16px on touch (no iOS zoom), 14px on desktop. */
export const fieldClass = cn(
  'w-full min-w-0 rounded-md border border-border-control bg-bg-surface text-base text-text sm:text-sm',
  'transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-text-tertiary',
  'focus-visible:border-accent-solid focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-danger-solid aria-invalid:focus-visible:ring-danger-solid/20',
)

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(fieldClass, 'h-9 px-3', className)} {...props} />
}

export { Input }
