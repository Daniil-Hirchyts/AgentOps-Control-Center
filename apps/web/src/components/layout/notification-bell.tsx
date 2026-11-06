import { Link } from '@tanstack/react-router'
import { Bell, BellOff } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, formatRelative } from '@/lib/utils'
import { selectUnreadNotifications, useRealtimeStore } from '@/stores/realtime'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const notifications = useRealtimeStore((s) => s.notifications)
  const unread = useRealtimeStore(selectUnreadNotifications)
  const markAllRead = useRealtimeStore((s) => s.markAllNotificationsRead)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) markAllRead()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
          data-testid="notification-bell"
        >
          <Bell />
          {unread > 0 && (
            <span
              data-testid="notification-count"
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <BellOff className="size-5" />
            No approval activity yet
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  to={n.href ?? '/'}
                  onClick={() => setOpen(false)}
                  className={cn('flex gap-3 px-4 py-2.5 text-sm hover:bg-muted', !n.read && 'bg-accent/40')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.title}</span>
                    {n.description && <span className="block truncate text-xs text-muted-foreground">{n.description}</span>}
                    <span className="block text-[11px] text-muted-foreground">
                      {formatRelative(new Date(n.createdAt).toISOString())}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
