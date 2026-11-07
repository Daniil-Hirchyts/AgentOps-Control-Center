import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AgentAvatar } from '@/components/shared/agent-avatar'
import { UserAvatar } from '@/components/shared/presence'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AGENTS } from '@/features/agents/agents'
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
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          data-testid="notification-bell"
        >
          <Bell strokeWidth={1.5} />
          {unread > 0 && (
            <span
              data-testid="notification-count"
              className="absolute top-1 end-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-solid px-1 text-[10px] font-semibold text-text-on-accent tabular-nums ring-2 ring-bg"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-1.5rem))]">
        <div className="flex h-11 items-center justify-between border-b px-4">
          <p className="text-13 font-medium">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              className="-me-2 h-8 rounded-md px-2 text-13 text-text-secondary hover:text-text"
              onClick={markAllRead}
            >
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-13 text-text-tertiary">Approval activity will show up here.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto overscroll-contain py-1">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  to={n.href ?? '/'}
                  onClick={() => setOpen(false)}
                  className="mx-1 flex gap-3 rounded-lg px-3 py-2.5 transition-colors duration-100 hover:bg-bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  {n.actor?.kind === 'user' ? (
                    <UserAvatar username={n.actor.username} size="md" />
                  ) : (
                    <AgentAvatar agent={AGENTS[n.actor?.kind === 'agent' ? n.actor.agent : 'relay']} size="md" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13 font-medium" title={n.title}>
                      {n.title}
                    </span>
                    {n.description && (
                      <span className="block truncate text-13 text-text-secondary" title={n.description}>
                        {n.description}
                      </span>
                    )}
                    <span className="block text-xs text-text-tertiary tabular-nums">
                      {formatRelative(new Date(n.createdAt).toISOString())}
                    </span>
                  </span>
                  <span
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent-solid')}
                    aria-label={n.read ? undefined : 'Unread'}
                    role={n.read ? undefined : 'img'}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
