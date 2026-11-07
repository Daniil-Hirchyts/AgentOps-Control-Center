/**
 * Date picker — a field-styled trigger that opens the Calendar in a popover.
 * Value is an ISO `YYYY-MM-DD` string so it drops straight into forms and the API.
 */
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

function parseIso(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

function toIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

const display = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder = 'Pick a date',
  invalid,
  testId,
  disableFuture = false,
  className,
}: {
  id?: string
  value: string | undefined
  onChange: (iso: string) => void
  onBlur?: () => void
  placeholder?: string
  invalid?: boolean
  testId?: string
  disableFuture?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIso(value)
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) onBlur?.()
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          data-testid={testId}
          data-value={value}
          className={cn(
            fieldClass,
            'inline-flex h-9 items-center gap-2 ps-3 pe-2.5 text-start tabular-nums',
            !selected && 'text-text-tertiary',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selected ? display.format(selected) : placeholder}</span>
          <CalendarDays className="size-4 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-xl p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disableFuture ? { after: new Date() } : undefined}
          onSelect={(d) => {
            if (d) onChange(toIso(d))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
