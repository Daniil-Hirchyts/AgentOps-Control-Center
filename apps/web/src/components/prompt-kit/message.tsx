/**
 * Message primitives — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * Markdown rendering was dropped: chat messages are plain text (rendered with `whitespace-pre-wrap`).
 */
import type * as React from 'react'
import { cn, initials } from '@/lib/utils'

export type MessageProps = React.HTMLAttributes<HTMLDivElement>

const Message = ({ children, className, ...props }: MessageProps) => (
  <div className={cn('flex gap-2', className)} {...props}>
    {children}
  </div>
)

export type MessageAvatarProps = { name: string; className?: string; hidden?: boolean }

/** Initials avatar; `hidden` keeps its slot so grouped bubbles stay aligned. */
const MessageAvatar = ({ name, className, hidden }: MessageAvatarProps) => (
  <span
    aria-hidden
    className={cn(
      'avatar-outline inline-flex size-7 shrink-0 items-center justify-center self-end rounded-full bg-bg-muted text-[11px] font-medium text-text-secondary',
      hidden && 'invisible',
      className,
    )}
  >
    {initials(name)}
  </span>
)

export type MessageContentProps = React.HTMLAttributes<HTMLDivElement>

const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn('rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap text-text', className)}
    {...props}
  >
    {children}
  </div>
)

const MessageActions = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2 text-text-tertiary', className)} {...props}>
    {children}
  </div>
)

export { Message, MessageActions, MessageAvatar, MessageContent }
