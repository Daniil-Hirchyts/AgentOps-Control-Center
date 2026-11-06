/**
 * Loaders — from prompt-kit (https://prompt-kit.com, MIT), trimmed to the variants we render and
 * restyled to our tokens. Keyframes (`typing`, `shimmer`) live in src/styles/index.css.
 */
import { cn } from '@/lib/utils'

export interface LoaderProps {
  variant?: 'circular' | 'typing' | 'text-shimmer'
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

const circleSize = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' }

export function CircularLoader({ className, size = 'md' }: Pick<LoaderProps, 'className' | 'size'>) {
  return (
    <span
      role="status"
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-text-tertiary',
        circleSize[size],
        className,
      )}
    >
      <span className="sr-only">Loading</span>
    </span>
  )
}

const dotSize = { sm: 'size-1', md: 'size-1.5', lg: 'size-2' }

/** Three dots, used for the chat typing indicator. */
export function TypingLoader({ className, size = 'md' }: Pick<LoaderProps, 'className' | 'size'>) {
  return (
    <span className={cn('inline-flex h-4 items-center gap-1', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          data-motion="transform"
          className={cn('animate-typing rounded-full bg-current', dotSize[size])}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  )
}

const textSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }

export function TextShimmerLoader({ text = 'Thinking', className, size = 'md' }: Omit<LoaderProps, 'variant'>) {
  return (
    <span
      className={cn(
        'animate-shimmer bg-[linear-gradient(to_right,var(--color-text-tertiary)_40%,var(--color-text)_50%,var(--color-text-tertiary)_60%)] bg-size-[200%_auto] bg-clip-text font-medium text-transparent',
        textSize[size],
        className,
      )}
    >
      {text}
    </span>
  )
}

function Loader({ variant = 'circular', size = 'md', text, className }: LoaderProps) {
  switch (variant) {
    case 'typing':
      return <TypingLoader size={size} className={className} />
    case 'text-shimmer':
      return <TextShimmerLoader text={text} size={size} className={className} />
    default:
      return <CircularLoader size={size} className={className} />
  }
}

export { Loader }
