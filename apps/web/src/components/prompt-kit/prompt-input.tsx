/**
 * Prompt input (composer) — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * Changes: no tooltip dependency, IME-safe Enter-to-send, 16px text on touch to avoid iOS zoom.
 */
import React, { createContext, useContext, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type PromptInputContextType = {
  value: string
  setValue: (value: string) => void
  maxHeight: number
  onSubmit?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const PromptInputContext = createContext<PromptInputContextType>({
  value: '',
  setValue: () => {},
  maxHeight: 200,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
})

export type PromptInputProps = {
  value: string
  onValueChange: (value: string) => void
  maxHeight?: number
  onSubmit?: () => void
  disabled?: boolean
  invalid?: boolean
} & React.ComponentProps<'div'>

function PromptInput({
  className,
  maxHeight = 200,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  invalid = false,
  onClick,
  ...props
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  return (
    <PromptInputContext.Provider
      value={{ value, setValue: onValueChange, maxHeight, onSubmit, disabled, textareaRef }}
    >
      <div
        onClick={(e) => {
          if (!disabled) textareaRef.current?.focus()
          onClick?.(e)
        }}
        data-invalid={invalid || undefined}
        className={cn(
          'cursor-text rounded-xl border border-input bg-surface transition-[border-color,box-shadow] duration-150',
          'focus-within:border-accent-solid focus-within:ring-3 focus-within:ring-ring/15',
          'data-invalid:border-danger data-invalid:focus-within:ring-danger/15',
          disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  )
}

export type PromptInputTextareaProps = React.ComponentProps<'textarea'>

function PromptInputTextarea({ className, onKeyDown, ...props }: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } = useContext(PromptInputContext)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value, maxHeight, textareaRef])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          onSubmit?.()
        }
        onKeyDown?.(e)
      }}
      rows={1}
      disabled={disabled}
      className={cn(
        'block min-h-10 w-full resize-none bg-transparent px-3 py-2.5 text-base text-text outline-none placeholder:text-text-tertiary focus-visible:outline-none sm:text-sm',
        className,
      )}
      {...props}
    />
  )
}

function PromptInputActions({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  )
}

export { PromptInput, PromptInputActions, PromptInputTextarea }
