/**
 * Calendar — react-day-picker v9 styled to our tokens. Today is marked with an underline
 * dot, the selected day takes the accent fill (the one filled thing in the popover).
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type * as React from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { cn } from '@/lib/utils'

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3 text-sm [--cell:2.25rem]', className)}
      classNames={{
        root: cn(d.root, 'w-fit'),
        months: 'relative flex flex-col gap-4',
        month: 'flex w-full flex-col gap-3',
        nav: 'absolute inset-x-0 top-0 flex h-(--cell) items-center justify-between',
        button_previous:
          'pressable inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-muted hover:text-text disabled:opacity-40',
        button_next:
          'pressable inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-muted hover:text-text disabled:opacity-40',
        month_caption: 'flex h-(--cell) items-center justify-center px-10',
        caption_label: 'text-sm font-medium text-text',
        dropdowns: 'flex items-center gap-1.5 text-sm font-medium',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex w-(--cell) items-center justify-center text-xs font-normal text-text-tertiary',
        week: 'mt-1 flex w-full',
        day: 'relative size-(--cell) p-0 text-center',
        day_button: cn(
          'pressable inline-flex size-(--cell) items-center justify-center rounded-md tabular-nums text-text',
          'hover:bg-bg-muted focus-visible:outline-2 focus-visible:outline-focus',
        ),
        today:
          "[&>button]:font-semibold [&>button]:after:absolute [&>button]:after:bottom-1.5 [&>button]:after:size-1 [&>button]:after:rounded-full [&>button]:after:bg-accent-solid [&>button]:after:content-['']",
        selected:
          '[&>button]:bg-accent-solid [&>button]:text-text-on-accent [&>button]:hover:bg-accent-solid-hover [&>button]:after:bg-text-on-accent',
        outside: '[&>button]:text-text-disabled',
        disabled: '[&>button]:text-text-disabled [&>button]:pointer-events-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', c)} strokeWidth={1.75} />
          ) : (
            <ChevronRight className={cn('size-4', c)} strokeWidth={1.75} />
          ),
      }}
      {...props}
    />
  )
}
