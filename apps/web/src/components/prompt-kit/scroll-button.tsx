/**
 * Scroll-to-bottom button — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * Only visible when the reader has scrolled away from the latest message.
 */
import { ArrowDown } from 'lucide-react'
import type * as React from 'react'
import { useStickToBottomContext } from 'use-stick-to-bottom'
import { cn } from '@/lib/utils'

export type ScrollButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

function ScrollButton({ className, ...props }: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  return (
    <button
      type="button"
      aria-label="Scroll to latest message"
      tabIndex={isAtBottom ? -1 : 0}
      aria-hidden={isAtBottom}
      data-motion="transform"
      className={cn(
        'pressable inline-flex size-9 items-center justify-center rounded-full border border-transparent bg-surface text-text-secondary shadow-overlay hover:text-text',
        'transition-[opacity,transform] duration-200 ease-out',
        isAtBottom ? 'pointer-events-none translate-y-2 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100',
        className,
      )}
      onClick={() => void scrollToBottom()}
      {...props}
    >
      <ArrowDown className="size-4" strokeWidth={1.75} />
    </button>
  )
}

export { ScrollButton }
