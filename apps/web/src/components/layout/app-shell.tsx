import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ConnectionStatus } from '@/components/shared/connection-pill'
import { useApprovals } from '@/features/approvals/hooks'
import { useUsers } from '@/features/messaging/hooks'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { selectTotalUnreadMessages, useRealtimeStore } from '@/stores/realtime'
import { isActive, NAV, type NavItem } from './nav'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

function useBadges() {
  const role = useAuthStore((s) => s.user?.role)
  const unreadMessages = useRealtimeStore(selectTotalUnreadMessages)
  const pending = useApprovals({ status: 'PENDING' }, { enabled: role === 'REVIEWER' })
  return {
    messages: unreadMessages,
    approvals: role === 'REVIEWER' ? (pending.data?.total ?? 0) : 0,
  }
}

function Count({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-solid px-1 text-[11px] font-medium text-accent-contrast tabular-nums',
        className,
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex h-8 items-center rounded-md text-[15px] font-semibold tracking-[-0.01em] text-text', className)}
    >
      AgentOps
    </Link>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.user?.role) ?? 'OPERATOR'
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const badges = useBadges()
  // Keep the people directory warm: realtime toasts resolve sender names from this cache.
  useUsers()
  const items = NAV[role]
  const badgeFor = (i: NavItem) => (i.badge ? badges[i.badge] : 0)
  // On phones an open conversation is a full-screen view with its own header and pinned composer.
  const immersive = !isDesktop && /^\/messages\/[^/]+/.test(pathname)

  if (isDesktop) {
    return (
      <div className="flex h-dvh overflow-hidden">
        <aside className="flex w-56 shrink-0 flex-col border-r bg-bg-subtle" aria-label="Main navigation">
          <div className="flex h-14 items-center justify-between pr-2 pl-5">
            <Wordmark />
            <NotificationBell />
          </div>
          <nav className="flex-1 space-y-px px-2 py-2">
            {items.map((item) => {
              const active = isActive(pathname, item)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-100',
                    active
                      ? 'bg-bg-muted font-medium text-text'
                      : 'text-text-secondary hover:bg-bg-muted/60 hover:text-text',
                  )}
                >
                  <Icon
                    className={cn('size-4', active ? 'text-accent-text' : 'text-text-tertiary')}
                    strokeWidth={active ? 2 : 1.5}
                  />
                  <span className="flex-1">{item.label}</span>
                  <Count n={badgeFor(item)} />
                </Link>
              )
            })}
          </nav>
          <div className="space-y-1 border-t px-2 py-2">
            <ConnectionStatus className="h-8 px-3 text-xs" />
            <UserMenu />
          </div>
        </aside>
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto" id="main">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {!immersive && (
        <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-bg pr-1.5 pl-4 pt-[env(safe-area-inset-top)]">
          <Wordmark />
          <div className="flex-1" />
          <ConnectionStatus compact className="px-2" />
          <NotificationBell />
          <UserMenu compact />
        </header>
      )}
      <main className="relative min-h-0 flex-1 overflow-y-auto" id="main">
        {children}
      </main>
      {!immersive && (
        <nav
          className="flex shrink-0 border-t bg-bg pb-[env(safe-area-inset-bottom)]"
          aria-label="Main navigation"
          data-testid="bottom-nav"
        >
          {items.map((item) => {
            const active = isActive(pathname, item)
            const Icon = item.icon
            const n = badgeFor(item)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px]',
                  active ? 'font-medium text-text' : 'text-text-tertiary',
                )}
              >
                <Icon className={cn('size-5', active && 'text-accent-text')} strokeWidth={active ? 2 : 1.5} />
                {item.label}
                {n > 0 && <Count n={n} className="absolute top-1.5 left-1/2 ml-1.5" />}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 py-5 sm:px-8 sm:py-8', className)}>{children}</div>
}
