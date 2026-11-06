import { Link, useRouterState } from '@tanstack/react-router'
import { Bot } from 'lucide-react'
import type { ReactNode } from 'react'
import { ConnectionPill } from '@/components/shared/connection-pill'
import { useApprovals } from '@/features/approvals/hooks'
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
        'flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground',
        className,
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Bot className="size-4.5" />
      </span>
      <span className="leading-tight">
        AgentOps
        <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Control Center
        </span>
      </span>
    </Link>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.user?.role) ?? 'OPERATOR'
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const badges = useBadges()
  const items = NAV[role]
  const badgeFor = (i: NavItem) => (i.badge ? badges[i.badge] : 0)

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex" aria-label="Main navigation">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {role === 'OPERATOR' ? 'Operations' : 'Review'}
          </p>
          {items.map((item) => {
            const active = isActive(pathname, item)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.label.toLowerCase()}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                <Count n={badgeFor(item)} />
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-3 text-[11px] text-muted-foreground">Human-in-the-loop AI approvals</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur sm:px-4">
          <Brand className="md:hidden" />
          <div className="flex-1" />
          <ConnectionPill compact />
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="relative min-h-0 flex-1 overflow-y-auto" id="main">
          {children}
        </main>
        <nav
          className="flex shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Bottom navigation"
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
                  'relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" />
                {item.label}
                {n > 0 && <Count n={n} className="absolute top-1 left-1/2 ml-2 h-4 min-w-4 text-[9px]" />}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl p-4 sm:p-6', className)}>{children}</div>
}
