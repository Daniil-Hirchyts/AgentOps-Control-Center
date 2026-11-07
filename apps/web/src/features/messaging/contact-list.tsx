import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { UserAvatar } from '@/components/shared/presence'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { Input } from '@/components/ui/input'
import { ROLE_LABEL } from '@/lib/labels'
import type { Id } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRealtimeStore } from '@/stores/realtime'
import { useContacts } from './hooks'
import { readSeenOnline } from './seen'

const OFFLINE_CAP = 5

export function ContactList({ selectedUserId }: { selectedUserId?: Id }) {
  const { contacts, isPending, isError, error, refetch } = useContacts()
  const [filter, setFilter] = useState('')
  const typing = useRealtimeStore((s) => s.typing)
  const unread = useRealtimeStore((s) => s.unreadMessages)

  const [showAll, setShowAll] = useState(false)
  // Read once per mount: someone coming online later does not shuffle the list under your cursor.
  const [seen] = useState(readSeenOnline)

  const query = filter.trim().toLowerCase()
  const visible = contacts.filter((c) => c.username.toLowerCase().includes(query))
  const online = visible.filter((c) => c.online)
  // Offline people: anyone seen online this session first, then A to Z. The order never depends on
  // what you click or read, so rows stay put; the open conversation and unread people are simply
  // never hidden behind "Show more".
  const offline = visible.filter((c) => !c.online).sort((a, b) => rank(b) - rank(a) || a.username.localeCompare(b.username))
  function rank(c: (typeof contacts)[number]) {
    return seen.has(c.id) ? 1 : 0
  }
  const capped =
    query || showAll ? offline : offline.filter((c, i) => i < OFFLINE_CAP || c.id === selectedUserId || (unread[c.id] ?? 0) > 0)
  const hiddenCount = offline.length - capped.length
  const onlineCount = contacts.filter((c) => c.online).length

  const row = (c: (typeof contacts)[number]) => {
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
            'flex h-14 items-center gap-3 rounded-lg px-2 transition-colors duration-150',
            active ? 'bg-bg-muted' : 'hover:bg-bg-muted/60',
          )}
        >
          <UserAvatar username={c.username} online={c.online} size="lg" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-baseline gap-2">
              <span className={cn('truncate text-sm', count > 0 || active ? 'font-medium' : '')}>{c.username}</span>
              <span className="text-xs text-text-tertiary">{ROLE_LABEL[c.role]}</span>
            </span>
            <span className="mt-0.5 block truncate text-13 text-text-secondary">
              {typing[c.id] ? 'Typing…' : c.online ? 'Online' : 'Offline'}
            </span>
          </span>
          {count > 0 && (
            <span
              data-testid={`unread-${c.username}`}
              aria-label={`${count} unread`}
              className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-solid px-1 text-[11px] font-medium text-text-on-accent tabular-nums"
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      </li>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-base font-semibold md:text-sm">Messages</h1>
          {!isPending && !isError && <span className="text-xs text-text-tertiary tabular-nums">{onlineCount} online</span>}
        </div>
        <div className="relative">
          <Search strokeWidth={1.5} className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="h-9 ps-8"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2" data-testid="contact-list">
        {isPending ? (
          <ListSkeleton rows={5} avatar className="px-2" />
        ) : isError ? (
          <ErrorState className="px-2" error={error} onRetry={() => void refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            className="px-2 sm:items-start sm:text-start"
            title={filter ? 'Nobody matches that name' : 'No one else here yet'}
            description={filter ? undefined : 'People appear here once they create an account.'}
          />
        ) : (
          <div className="space-y-4">
            {online.length > 0 && (
              <section aria-labelledby="contacts-online">
                <h2 id="contacts-online" className="px-2 pb-1 text-xs font-medium text-text-tertiary">
                  Online · {online.length}
                </h2>
                <ul className="space-y-px">{online.map(row)}</ul>
              </section>
            )}
            {offline.length > 0 && (
              <section aria-labelledby="contacts-offline">
                <h2 id="contacts-offline" className="px-2 pb-1 text-xs font-medium text-text-tertiary">
                  Offline · {offline.length}
                </h2>
                <ul className="space-y-px">{capped.map(row)}</ul>
                {(hiddenCount > 0 || (showAll && !query && offline.length > OFFLINE_CAP)) && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="pressable mt-1 h-9 w-full rounded-lg px-2 text-start text-13 font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-muted/60 hover:text-text"
                  >
                    {showAll ? 'Show fewer' : `Show ${hiddenCount} more`}
                  </button>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
