import { ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { PromptInput, PromptInputActions, PromptInputTextarea } from '@/components/prompt-kit/prompt-input'
import { cn } from '@/lib/utils'
import { MAX_MESSAGE_LENGTH } from './types'

interface Props {
  onSend: (text: string) => void
  onTyping?: () => void
  onStopTyping?: () => void
  disabled?: boolean
  placeholder?: string
}

/** Message composer built on prompt-kit's PromptInput: Enter sends, Shift+Enter adds a line. */
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

  return (
    <form
      className="shrink-0 bg-bg px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <PromptInput
        value={text}
        onValueChange={(v) => {
          setText(v)
          if (v.trim()) onTyping?.()
          else onStopTyping?.()
        }}
        onSubmit={submit}
        invalid={tooLong}
        className="mx-auto flex max-w-3xl items-end gap-1 pe-1.5"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          aria-label="Message"
          aria-invalid={tooLong}
          aria-describedby={text.length > MAX_MESSAGE_LENGTH - 500 ? 'char-counter' : undefined}
          onBlur={onStopTyping}
          enterKeyHint="send"
          data-testid="message-input"
        />
        <PromptInputActions className="shrink-0 py-1.5">
          {text.length > MAX_MESSAGE_LENGTH - 500 && (
            <span
              id="char-counter"
              className={cn('px-1 text-xs tabular-nums', tooLong ? 'text-danger-text' : 'text-text-tertiary')}
              data-testid="char-counter"
            >
              {text.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            data-testid="send-button"
            onClick={(e) => e.stopPropagation()}
            className="pressable relative inline-flex size-8 items-center after:absolute after:-inset-1.5 after:content-[''] after:rounded-full justify-center rounded-full bg-ink text-text-on-ink hover:bg-ink-hover disabled:bg-bg-muted disabled:text-text-tertiary"
          >
            <ArrowUp className="size-4" strokeWidth={2} />
          </button>
        </PromptInputActions>
      </PromptInput>
    </form>
  )
}
