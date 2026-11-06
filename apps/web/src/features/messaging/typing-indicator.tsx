export function TypingIndicator({ username }: { username: string }) {
  return (
    <div className="mx-auto mt-2 flex max-w-3xl items-center gap-2 text-xs text-muted-foreground" data-testid="typing-indicator">
      <span className="flex gap-0.5 rounded-full border bg-card px-2.5 py-2">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </span>
      {username} is typing…
    </div>
  )
}
