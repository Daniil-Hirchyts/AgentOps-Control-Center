import { TypingLoader } from '@/components/prompt-kit/loader'
import { MessageAvatar } from '@/components/prompt-kit/message'

/** Incoming-side bubble with three dots (prompt-kit "typing" loader). */
export function TypingIndicator({ username }: { username: string }) {
  return (
    <div className="mt-2 flex items-end gap-2" data-testid="typing-indicator">
      <MessageAvatar name={username} />
      <span className="inline-flex h-8 items-center rounded-lg rounded-bl-sm bg-bg-muted px-3 text-text-tertiary">
        <TypingLoader size="sm" />
      </span>
      <span className="sr-only">{username} is typing…</span>
    </div>
  )
}
