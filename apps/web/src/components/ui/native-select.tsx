import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(fieldClass, 'h-9 appearance-none pr-8 pl-3', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-tertiary"
      />
    </div>
  )
}

export { NativeSelect }
