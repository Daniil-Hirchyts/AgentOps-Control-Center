import { Link } from '@tanstack/react-router'
import { Search, Users } from 'lucide-react'
import { useState } from 'react'
import { RoleBadge, UserAvatar } from '@/components/shared/presence'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { Input } from '@/components/ui/input'
import type { Id } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRealtimeStore } from '@/stores/realtime'
import { useContacts } from './hooks'

export function ContactList({ selectedUserId }: { selectedUserId?: Id }) {
  const { contacts, isPending, isError, error, refetch } = useContacts()
  const [filter, setFilter] = useState('')
  const typing = useRealtimeStore((s) => s.typing)
  const unread = useRealtimeStore((s) => s.unreadMessages)

  const visible = contacts.filter((c) => c.username.toLowerCase().includes(filter.trim().toLowerCase()))
  const onlineCount = contacts.filter((c) => c.online).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contacts</h2>
          {!isPending && !isError && (
            <span className="text-xs text-muted-foreground">
              {onlineCount}/{contacts.length} online
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search people"
            aria-label="Search contacts"
            className="pl-8"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="contact-list">
        {isPending ? (
          <ListSkeleton rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filter ? 'No match' : 'No other users yet'}
            description={filter ? undefined : 'Ask a colleague to create an account.'}
            className="border-0"
          />
        ) : (
          <ul className="space-y-0.5">
            {visible.map((c) => {
              const active = c.id === selectedUserId
              const count = unread[c.id] ?? 0
              return (
                <li key={c.id}>
                  <Link
                    to="/messages/$userId"
                    params={{ userId: String(c.id) }}
                    data-testid={`contact-${c.username}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <UserAvatar username={c.username} online={c.online} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.username}</span>
                        <RoleBadge role={c.role} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {typing[c.id] ? (
                          <span className="text-primary italic">typing…</span>
                        ) : c.online ? (
                          'Online'
                        ) : (
                          'Offline'
                        )}
                      </span>
                    </span>
                    {count > 0 && (
                      <span
                        data-testid={`unread-${c.username}`}
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
