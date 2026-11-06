import { SendHorizontal } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MAX_MESSAGE_LENGTH } from './types'

interface Props {
  onSend: (text: string) => void
  onTyping?: () => void
  onStopTyping?: () => void
  disabled?: boolean
  placeholder?: string
}

export function Composer({ onSend, onTyping, onStopTyping, disabled, placeholder = 'Write a message…' }: Props) {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  const tooLong = text.length > MAX_MESSAGE_LENGTH
  const canSend = !disabled && trimmed.length > 0 && !tooLong

  const submit = () => {
    if (!canSend) return
    onSend(trimmed)
    onStopTyping?.()
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="border-t bg-card px-3 py-3 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (e.target.value.trim()) onTyping?.()
              else onStopTyping?.()
            }}
            onKeyDown={onKeyDown}
            onBlur={onStopTyping}
            rows={1}
            placeholder={placeholder}
            aria-label="Message"
            aria-invalid={tooLong}
            data-testid="message-input"
            className={cn(
              'field-sizing-content max-h-40 min-h-10 w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              tooLong && 'border-destructive',
            )}
          />
          {text.length > MAX_MESSAGE_LENGTH - 500 && (
            <span
              className={cn(
                'absolute right-2 bottom-1 text-[10px]',
                tooLong ? 'text-destructive' : 'text-muted-foreground',
              )}
              data-testid="char-counter"
            >
              {text.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          className="size-10 rounded-xl"
          disabled={!canSend}
          aria-label="Send message"
          data-testid="send-button"
        >
          <SendHorizontal />
        </Button>
      </div>
      <p className="mx-auto mt-1 hidden max-w-3xl text-[10px] text-muted-foreground sm:block">
        Enter to send · Shift+Enter for a new line
      </p>
    </form>
  )
}
