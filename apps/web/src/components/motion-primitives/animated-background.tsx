/**
 * AnimatedBackground — from motion-primitives by ibelick (https://motion-primitives.com,
 * https://github.com/ibelick/motion-primitives, MIT). Installed through the shadcn registry
 * (`https://motion-primitives.com/c/animated-background.json`) and adapted:
 *  - optional controlled `value` (the active segment follows router/search state),
 *  - typed children (no `any`), keyboard-safe (we keep native buttons as children).
 * A single shared `layoutId` slides the highlight between segments.
 */
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { Children, cloneElement, type ReactElement, useId, useState } from 'react'
import { cn } from '@/lib/utils'

type ChildProps = { 'data-id': string; className?: string; children?: React.ReactNode }

export type AnimatedBackgroundProps = {
  children: ReactElement<ChildProps>[] | ReactElement<ChildProps>
  defaultValue?: string
  value?: string | null
  onValueChange?: (newActiveId: string | null) => void
  className?: string
  transition?: Transition
  enableHover?: boolean
}

export function AnimatedBackground({
  children,
  defaultValue,
  value,
  onValueChange,
  className,
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [internal, setInternal] = useState<string | null>(defaultValue ?? null)
  const activeId = value !== undefined ? value : internal
  const uniqueId = useId()

  const set = (id: string | null) => {
    setInternal(id)
    onValueChange?.(id)
  }

  return Children.map(children, (child, index) => {
    const id = child.props['data-id']
    const interactionProps = enableHover
      ? { onMouseEnter: () => set(id), onMouseLeave: () => set(null) }
      : { onClick: () => set(id) }

    return cloneElement(
      child,
      {
        key: index,
        className: cn('relative inline-flex', child.props.className),
        'data-checked': activeId === id ? 'true' : 'false',
        ...interactionProps,
      } as unknown as Partial<ChildProps>,
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={`background-${uniqueId}`}
              className={cn('absolute inset-0', className)}
              transition={transition}
              initial={{ opacity: defaultValue !== undefined || value !== undefined ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        <span className="relative z-10 inline-flex items-center gap-1.5">{child.props.children}</span>
      </>,
    )
  })
}
