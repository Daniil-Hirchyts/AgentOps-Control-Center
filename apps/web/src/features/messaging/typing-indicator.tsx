import { TypingLoader } from '@/components/prompt-kit/loader'
import { UserAvatar } from '@/components/shared/presence'

/** Incoming-side bubble with three dots (prompt-kit "typing" loader). */
export function TypingIndicator({ username }: { username: string }) {
  return (
    <div className="mt-2 flex items-end gap-2" data-testid="typing-indicator">
      <UserAvatar username={username} size="sm" />
      <span className="inline-flex h-8 items-center rounded-lg rounded-es-sm bg-bg-muted px-3 text-text-tertiary">
        <TypingLoader size="sm" />
      </span>
      <span className="sr-only">{username} is typing…</span>
    </div>
  )
}
