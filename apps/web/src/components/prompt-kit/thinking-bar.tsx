/**
 * Thinking bar — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * The agent's live state while a run is in flight.
 */
import { ChevronRight } from 'lucide-react'
import { TextShimmer } from '@/components/prompt-kit/text-shimmer'
import { cn } from '@/lib/utils'

export function ThinkingBar({
  className,
  text = 'Thinking',
  detail,
  onClick,
}: {
  className?: string
  text?: string
  detail?: string
  onClick?: () => void
}) {
  const label = (
    <>
      <TextShimmer className="text-sm">{text}</TextShimmer>
      {detail && <span className="truncate text-13 text-text-tertiary">{detail}</span>}
    </>
  )
  return (
    <div className={cn('flex w-full min-w-0 items-center gap-2', className)} role="status" aria-live="polite">
      {onClick ? (
        <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-2 text-start">
          {label}
          <ChevronRight className="size-4 text-text-tertiary" strokeWidth={1.5} />
        </button>
      ) : (
        label
      )}
    </div>
  )
}
