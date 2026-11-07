/**
 * Tool — from prompt-kit (https://prompt-kit.com, MIT), restyled to our tokens.
 * Shows one tool call the agent made (the model request, the approved action) with its
 * input, output and state. State is a dot plus a word, never colour alone.
 */
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export type ToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'skipped'

export type ToolPart = {
  /** Human name of the call, e.g. "Analyze invoice". */
  title: string
  /** Machine name, shown small in monospace. */
  name?: string
  state: ToolState
  input?: Record<string, unknown>
  output?: Record<string, unknown> | string
  errorText?: string
  icon?: ReactNode
  /** Rendered as-is in place of the icon box (an agent avatar). */
  avatar?: ReactNode
  meta?: ReactNode
  /** Overrides the state word, e.g. "Rejected" or "Ran once". */
  stateLabel?: string
}

const STATE: Record<ToolState, { label: string; dot: string }> = {
  'input-streaming': { label: 'Running', dot: 'bg-accent-solid animate-pulse-soft' },
  'input-available': { label: 'Waiting', dot: 'bg-warning-solid' },
  'output-available': { label: 'Done', dot: 'bg-success-solid' },
  'output-error': { label: 'Error', dot: 'bg-danger-solid' },
  skipped: { label: 'Skipped', dot: 'border border-neutral-solid' },
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

export function Tool({
  toolPart,
  defaultOpen = false,
  className,
  testId,
}: {
  toolPart: ToolPart
  defaultOpen?: boolean
  className?: string
  testId?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const { state, input, output, errorText } = toolPart
  const s = STATE[state]
  const hasBody = (input && Object.keys(input).length > 0) || output !== undefined || !!errorText

  return (
    <div className={cn('surface overflow-hidden rounded-xl', className)} data-testid={testId} data-state={state}>
      <Collapsible open={open} onOpenChange={setOpen} disabled={!hasBody}>
        <CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-3 px-3 text-start transition-colors duration-150 hover:bg-bg-subtle focus-visible:-outline-offset-2 disabled:cursor-default disabled:hover:bg-transparent">
          {toolPart.avatar}
          {!toolPart.avatar && toolPart.icon && (
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-bg-muted text-text-secondary [&_svg]:size-4">
              {toolPart.icon}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-text">{toolPart.title}</span>
            {(toolPart.name || toolPart.meta) && (
              <span className="truncate text-xs text-text-tertiary">
                {toolPart.name && <span className="font-mono">{toolPart.name}</span>}
                {toolPart.name && toolPart.meta ? ' · ' : null}
                {toolPart.meta}
              </span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-13 text-text-secondary">
            <span aria-hidden className={cn('size-2 rounded-full', s.dot)} />
            {toolPart.stateLabel ?? s.label}
          </span>
          {hasBody && (
            <ChevronDown
              aria-hidden
              strokeWidth={1.5}
              className="size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
            />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="space-y-4 border-t border-separator px-3 py-3">
            {input && Object.keys(input).length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-text-tertiary">Input</h4>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-md bg-bg-sunken px-3 py-2 font-mono text-xs">
                  {Object.entries(input).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-text-tertiary">{k}</dt>
                      <dd className="min-w-0 break-words whitespace-pre-wrap text-text">{formatValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {output !== undefined && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-text-tertiary">Output</h4>
                <pre className="max-h-60 overflow-auto overscroll-contain rounded-md bg-bg-sunken px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-text">
                  {formatValue(output)}
                </pre>
              </div>
            )}
            {errorText && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-danger-text">Error</h4>
                <p className="rounded-md bg-danger-subtle px-3 py-2 text-13 text-danger-text">{errorText}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
