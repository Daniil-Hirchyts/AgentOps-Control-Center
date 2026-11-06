/**
 * Chat container — from prompt-kit (https://prompt-kit.com, MIT), installed via the shadcn registry
 * and restyled to our tokens. Stick-to-bottom scrolling is provided by `use-stick-to-bottom`.
 */
import type * as React from 'react'
import { StickToBottom } from 'use-stick-to-bottom'
import { cn } from '@/lib/utils'

export type ChatContainerRootProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

function ChatContainerRoot({ children, className, ...props }: ChatContainerRootProps) {
  return (
    <StickToBottom
      className={cn('relative flex min-h-0 overflow-hidden', className)}
      resize="smooth"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  )
}

function ChatContainerContent({
  children,
  className,
  scrollClassName,
  ...props
}: ChatContainerRootProps & { scrollClassName?: string }) {
  return (
    <StickToBottom.Content
      className={cn('flex w-full flex-col', className)}
      scrollClassName={cn('overscroll-contain', scrollClassName)}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  )
}

function ChatContainerScrollAnchor({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('h-px w-full shrink-0 scroll-mt-4', className)} aria-hidden="true" {...props} />
}

export { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor }
