/**
 * Chain of thought — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * The agent's reasoning as collapsible steps on one rail: what it read, what it compared,
 * what it concluded.
 */
import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export const ChainOfThoughtItem = ({ children, className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('text-13 leading-relaxed text-text-secondary', className)} {...props}>
    {children}
  </div>
)

export type ChainOfThoughtTriggerProps = React.ComponentProps<typeof CollapsibleTrigger> & {
  leftIcon?: React.ReactNode
}

export const ChainOfThoughtTrigger = ({ children, className, leftIcon, ...props }: ChainOfThoughtTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      'group flex min-h-8 w-full items-center gap-2.5 text-start text-sm text-text transition-colors duration-150 hover:text-text',
      className,
    )}
    {...props}
  >
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center text-text-tertiary [&_svg]:size-4">
      {leftIcon ?? <span className="size-1.5 rounded-full bg-current" />}
    </span>
    <span className="min-w-0 flex-1">{children}</span>
    <ChevronDown
      aria-hidden
      strokeWidth={1.5}
      className="size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
    />
  </CollapsibleTrigger>
)

export const ChainOfThoughtContent = ({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent
    className={cn(
      'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
      className,
    )}
    {...props}
  >
    <div className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-4">
      <div className="ms-[7.5px] h-full w-px bg-border group-data-[last=true]:bg-transparent" />
      <div className="space-y-2 pt-1 pb-3">{children}</div>
    </div>
  </CollapsibleContent>
)

export function ChainOfThought({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children)
  return (
    <div className={className}>
      {items.map((child, index) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<ChainOfThoughtStepProps>, {
              key: index,
              isLast: index === items.length - 1,
            })
          : null,
      )}
    </div>
  )
}

export type ChainOfThoughtStepProps = React.ComponentProps<typeof Collapsible> & { isLast?: boolean }

export const ChainOfThoughtStep = ({ children, className, isLast = false, ...props }: ChainOfThoughtStepProps) => (
  <Collapsible className={cn('group', className)} data-last={isLast} {...props}>
    {children}
    <div className="flex group-data-[last=true]:hidden group-data-[state=open]:hidden">
      <div className="ms-[7.5px] h-3 w-px bg-border" />
    </div>
  </Collapsible>
)
