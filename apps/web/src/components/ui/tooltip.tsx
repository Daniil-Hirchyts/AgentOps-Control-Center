import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Small dark label next to icon-only controls; a short delay so it never flickers on pass-over. */
export function Tooltip({
  label,
  side = 'right',
  children,
}: {
  label: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={cn(
              'z-50 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-text-on-ink',
              'origin-(--radix-tooltip-content-transform-origin) data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            )}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
