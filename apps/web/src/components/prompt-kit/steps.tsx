/**
 * Steps — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * A collapsible list of agent steps with a vertical rail; used for the run timeline.
 */
import { ChevronDown } from 'lucide-react'
import type * as React from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export const StepsItem = ({ children, className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('text-sm text-text-secondary', className)} {...props}>
    {children}
  </div>
)

export type StepsTriggerProps = React.ComponentProps<typeof CollapsibleTrigger> & { leftIcon?: React.ReactNode }

export const StepsTrigger = ({ children, className, leftIcon, ...props }: StepsTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      'group flex min-h-9 w-full items-center gap-2 rounded-md text-start text-sm text-text-secondary transition-colors duration-150 hover:text-text',
      className,
    )}
    {...props}
  >
    {leftIcon && <span className="inline-flex size-4 items-center justify-center">{leftIcon}</span>}
    <span className="min-w-0 flex-1">{children}</span>
    <ChevronDown
      className="size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
      strokeWidth={1.5}
    />
  </CollapsibleTrigger>
)

export type StepsContentProps = React.ComponentProps<typeof CollapsibleContent> & { bar?: React.ReactNode }

export const StepsContent = ({ children, className, bar, ...props }: StepsContentProps) => (
  <CollapsibleContent
    className={cn(
      'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
      className,
    )}
    {...props}
  >
    <div className="mt-2 grid max-w-full min-w-0 grid-cols-[min-content_minmax(0,1fr)] items-start gap-x-3">
      <div className="min-w-0 self-stretch">{bar ?? <StepsBar />}</div>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  </CollapsibleContent>
)

export const StepsBar = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('ms-[7px] h-full w-px bg-border', className)} aria-hidden {...props} />
)

export function Steps({ defaultOpen = true, ...props }: React.ComponentProps<typeof Collapsible>) {
  return <Collapsible defaultOpen={defaultOpen} {...props} />
}
