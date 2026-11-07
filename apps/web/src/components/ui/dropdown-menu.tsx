import { DropdownMenu as DM } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const DropdownMenu = DM.Root
const DropdownMenuTrigger = DM.Trigger

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[10rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg border border-transparent bg-bg-surface p-1 text-text shadow-overlay',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  )
}

function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DM.Item> & { variant?: 'default' | 'danger' }) {
  return (
    <DM.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none focus:bg-bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:h-8 [&_svg]:text-text-tertiary [&_svg:not([class*='size-'])]:size-4",
        variant === 'danger' && 'text-danger-text [&_svg]:text-danger-text',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('px-2 py-1.5 text-sm', className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
