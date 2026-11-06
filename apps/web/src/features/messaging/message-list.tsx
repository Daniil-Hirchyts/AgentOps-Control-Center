import { AlertCircle, Check, Clock, RotateCcw, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import type { Id } from '@/lib/types'
import { cn, dayKey, formatDayLabel, formatTime } from '@/lib/utils'
import type { ChatMessage } from './types'

interface Props {
  messages: ChatMessage[]
  meId: Id
  onRetry?: (m: ChatMessage) => void
  onDiscard?: (m: ChatMessage) => void
  footer?: React.ReactNode
}

export function MessageList({ messages, meId, onRetry, onDiscard, footer }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const last = messages[messages.length - 1]
  const lastKey = last ? `${last.id}:${last.clientMessageId ?? ''}:${messages.length}` : ''

  // Auto-scroll when new messages arrive if the user is near the bottom, or sent the message.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (stickToBottom.current || last?.expediteurId === meId) {
      el.scrollTop = el.scrollHeight
    }
  }, [lastKey, last?.expediteurId, meId])

  // keep the typing indicator visible when it appears
  useEffect(() => {
    const el = scrollRef.current
    if (el && footer && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [footer])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
      data-testid="message-list"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <ol className="mx-auto flex max-w-3xl flex-col gap-1">
        {messages.map((m, i) => {
          const mine = m.expediteurId === meId
          const prev = messages[i - 1]
          const showDay = !prev || dayKey(prev.dateEnvoi) !== dayKey(m.dateEnvoi)
          const grouped = !showDay && prev?.expediteurId === m.expediteurId
          return (
            <Fragment key={m.clientMessageId ?? m.id}>
              {showDay && (
                <li className="my-3 flex items-center gap-3 text-[11px] font-medium text-muted-foreground" data-testid="day-separator">
                  <span className="h-px flex-1 bg-border" />
                  {formatDayLabel(m.dateEnvoi)}
                  <span className="h-px flex-1 bg-border" />
                </li>
              )}
              <li className={cn('flex flex-col', mine ? 'items-end' : 'items-start', !grouped && 'mt-2')}>
                <div
                  data-testid="message-bubble"
                  data-mine={mine ? 'true' : 'false'}
                  data-delivery={m.delivery ?? 'sent'}
                  data-message-id={m.id > 0 ? m.id : undefined}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap shadow-xs sm:max-w-[70%]',
                    mine
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md border bg-card text-card-foreground',
                    m.delivery === 'sending' && 'opacity-70',
                    m.delivery === 'failed' && 'bg-destructive/10 text-foreground ring-1 ring-destructive/40',
                  )}
                >
                  {m.contenu}
                </div>
                <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                  {m.delivery === 'failed' ? (
                    <span className="flex items-center gap-1.5 text-destructive" data-testid="message-failed">
                      <AlertCircle className="size-3" />
                      {m.failureReason ?? 'Not delivered'}
                      {onRetry && (
                        <button
                          type="button"
                          onClick={() => onRetry(m)}
                          className="inline-flex items-center gap-0.5 font-medium underline-offset-2 hover:underline"
                        >
                          <RotateCcw className="size-3" /> Retry
                        </button>
                      )}
                      {onDiscard && (
                        <button
                          type="button"
                          onClick={() => onDiscard(m)}
                          aria-label="Discard message"
                          className="inline-flex items-center hover:underline"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </span>
                  ) : (
                    <>
                      <time dateTime={m.dateEnvoi}>{formatTime(m.dateEnvoi)}</time>
                      {mine &&
                        (m.delivery === 'sending' ? (
                          <Clock className="size-3" aria-label="Sending" />
                        ) : (
                          <Check className="size-3" aria-label="Sent" />
                        ))}
                    </>
                  )}
                </div>
              </li>
            </Fragment>
          )
        })}
      </ol>
      {footer}
    </div>
  )
}
