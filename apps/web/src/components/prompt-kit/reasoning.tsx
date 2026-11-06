/**
 * Reasoning disclosure — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * Markdown rendering dropped (the agent's reasoning summary is plain text). Auto-opens while
 * `isStreaming` and stays open after, so the operator never loses what they were reading.
 */
import { ChevronDown } from 'lucide-react'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Ctx = { isOpen: boolean; onOpenChange: (open: boolean) => void; contentId: string }
const ReasoningContext = createContext<Ctx | undefined>(undefined)

function useReasoning() {
  const ctx = useContext(ReasoningContext)
  if (!ctx) throw new Error('Reasoning components must be used within <Reasoning>')
  return ctx
}

export type ReasoningProps = {
  children: React.ReactNode
  className?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function Reasoning({ children, className, open, defaultOpen = false, onOpenChange }: ReasoningProps) {
  const [internal, setInternal] = useState(defaultOpen)
  const contentId = React.useId()
  const isOpen = open ?? internal
  return (
    <ReasoningContext.Provider
      value={{
        isOpen,
        contentId,
        onOpenChange: (o) => {
          if (open === undefined) setInternal(o)
          onOpenChange?.(o)
        },
      }}
    >
      <div className={className}>{children}</div>
    </ReasoningContext.Provider>
  )
}

function ReasoningTrigger({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isOpen, onOpenChange, contentId } = useReasoning()
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={contentId}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md text-13 font-medium text-text-secondary transition-colors duration-150 hover:text-text',
        className,
      )}
      onClick={() => onOpenChange(!isOpen)}
      {...props}
    >
      {children}
      <ChevronDown
        strokeWidth={1.5}
        className={cn('size-4 text-text-tertiary transition-transform duration-200 ease-out', isOpen && 'rotate-180')}
      />
    </button>
  )
}

function ReasoningContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen, contentId } = useReasoning()
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const measure = () => setHeight(el.scrollHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      id={contentId}
      hidden={!isOpen && height === undefined}
      aria-hidden={!isOpen}
      className={cn('overflow-hidden transition-[max-height,opacity] duration-200 ease-out', !isOpen && 'opacity-0')}
      style={{ maxHeight: isOpen ? (height ?? 'none') : 0 }}
      {...props}
    >
      <div ref={innerRef} className={cn('pt-2 text-sm text-text', className)}>
        {children}
      </div>
    </div>
  )
}

export { Reasoning, ReasoningContent, ReasoningTrigger }
