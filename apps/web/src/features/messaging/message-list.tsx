import { type ReactNode, useEffect, useState } from 'react'
import { useStickToBottomContext } from 'use-stick-to-bottom'
import { ChatContainerContent, ChatContainerRoot } from '@/components/prompt-kit/chat-container'
import { Message, MessageAvatar, MessageContent } from '@/components/prompt-kit/message'
import { ScrollButton } from '@/components/prompt-kit/scroll-button'
import type { Id } from '@/lib/types'
import { cn, dayKey, formatDateTime, formatDayLabel, formatTime } from '@/lib/utils'
import type { ChatMessage } from './types'

interface Props {
  messages: ChatMessage[]
  meId: Id
  /** Name shown on the other side's avatar. */
  otherName: string
  onRetry?: (m: ChatMessage) => void
  onDiscard?: (m: ChatMessage) => void
  footer?: ReactNode
  empty?: ReactNode
}

const GROUP_WINDOW_MS = 5 * 60_000

const keyOf = (m: ChatMessage) => m.clientMessageId ?? String(m.id)

export function MessageList({ messages, meId, otherName, onRetry, onDiscard, footer, empty }: Props) {
  // Keys present when the conversation first rendered = history. Only later arrivals animate in.
  const [historyKeys] = useState(() => new Set(messages.map(keyOf)))

  return (
    <ChatContainerRoot className="flex-1" data-testid="message-list" aria-live="polite" aria-relevant="additions">
      <ChatContainerContent className="mx-auto max-w-3xl px-3 pt-4 pb-3 sm:px-6">
        {messages.length === 0 && empty}
        <ol className="flex flex-col">
          {messages.map((m, i) => {
            const mine = m.expediteurId === meId
            const prev = messages[i - 1]
            const next = messages[i + 1]
            const showDay = !prev || dayKey(prev.dateEnvoi) !== dayKey(m.dateEnvoi)
            const joinsPrev = !showDay && !!prev && sameGroup(prev, m)
            const joinsNext = !!next && dayKey(next.dateEnvoi) === dayKey(m.dateEnvoi) && sameGroup(m, next)
            const isNew = !historyKeys.has(keyOf(m))
            return (
              <li key={keyOf(m)} className="flex flex-col">
                {showDay && <DaySeparator iso={m.dateEnvoi} />}
                <div className={cn(joinsPrev ? 'mt-0.5' : 'mt-3', isNew && 'animate-message-in')} data-motion={isNew ? 'transform' : undefined}>
                  <Message className={cn('items-end', mine ? 'flex-row-reverse' : 'flex-row')}>
                    {!mine && <MessageAvatar name={otherName} hidden={joinsNext} />}
                    <MessageContent
                      data-testid="message-bubble"
                      data-mine={mine ? 'true' : 'false'}
                      data-delivery={m.delivery ?? 'sent'}
                      data-message-id={m.id > 0 ? m.id : undefined}
                      title={formatDateTime(m.dateEnvoi)}
                      className={cn(
                        'max-w-[82%] min-w-0 leading-normal sm:max-w-[68%]',
                        mine ? 'bg-accent-solid text-text-on-accent' : 'bg-bg-muted text-text',
                        mine ? joinsPrev && 'rounded-se-sm' : joinsPrev && 'rounded-ss-sm',
                        mine ? joinsNext && 'rounded-ee-sm' : joinsNext && 'rounded-es-sm',
                        m.delivery === 'sending' && 'opacity-60',
                        m.delivery === 'failed' && 'bg-bg-muted text-text ring-1 ring-danger-solid/60 ring-inset',
                      )}
                    >
                      {m.contenu}
                    </MessageContent>
                  </Message>
                  {m.delivery === 'failed' ? (
                    <div className={cn('flex', mine ? 'justify-end' : 'ps-9')}>
                      <FailedMeta message={m} onRetry={onRetry} onDiscard={onDiscard} />
                    </div>
                  ) : (
                    !joinsNext && (
                      <p className={cn('mt-1 px-1 text-xs text-text-tertiary tabular-nums', mine ? 'text-end' : 'ps-10')}>
                        <time dateTime={m.dateEnvoi}>{formatTime(m.dateEnvoi)}</time>
                        {mine && (m.delivery === 'sending' ? ' · Sending…' : ' · Sent')}
                      </p>
                    )
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        {footer}
        <FollowOwnMessages messages={messages} meId={meId} />
      </ChatContainerContent>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <ScrollButton className="pointer-events-auto" />
      </div>
    </ChatContainerRoot>
  )
}

function sameGroup(a: ChatMessage, b: ChatMessage) {
  return (
    a.expediteurId === b.expediteurId &&
    Math.abs(new Date(b.dateEnvoi).getTime() - new Date(a.dateEnvoi).getTime()) < GROUP_WINDOW_MS &&
    a.delivery !== 'failed'
  )
}

function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex justify-center" data-testid="day-separator">
      <span className="text-xs font-medium text-text-tertiary tabular-nums">{formatDayLabel(iso)}</span>
    </div>
  )
}

function FailedMeta({
  message: m,
  onRetry,
  onDiscard,
}: {
  message: ChatMessage
  onRetry?: (m: ChatMessage) => void
  onDiscard?: (m: ChatMessage) => void
}) {
  return (
    <span className="mt-1 flex items-center gap-1 px-1 text-xs text-danger-text" data-testid="message-failed" role="alert">
      {m.failureReason ?? 'Not delivered'}
      {onRetry && (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => onRetry(m)}
            className="-my-2 h-8 rounded px-1 font-medium underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </>
      )}
      {onDiscard && (
        <button
          type="button"
          onClick={() => onDiscard(m)}
          className="-my-2 h-8 rounded px-1 text-text-tertiary hover:text-text"
        >
          Discard
        </button>
      )}
    </span>
  )
}

/** When I send a message, jump to the bottom even if I had scrolled up. */
function FollowOwnMessages({ messages, meId }: { messages: ChatMessage[]; meId: Id }) {
  const { scrollToBottom } = useStickToBottomContext()
  const last = messages[messages.length - 1]
  const lastKey = last ? keyOf(last) : ''
  const lastMine = last?.expediteurId === meId
  useEffect(() => {
    if (lastKey && lastMine) void scrollToBottom()
  }, [lastKey, lastMine, scrollToBottom])
  return null
}
