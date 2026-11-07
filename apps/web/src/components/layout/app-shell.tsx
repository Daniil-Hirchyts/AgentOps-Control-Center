import { Link, useRouterState } from '@tanstack/react-router'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { ConnectionStatus } from '@/components/shared/connection-pill'
import { useApprovals } from '@/features/approvals/hooks'
import { useUsers } from '@/features/messaging/hooks'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/hooks'
import { Wordmark as BrandWordmark } from '@/components/shared/logo'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { selectTotalUnreadMessages, useRealtimeStore } from '@/stores/realtime'
import { useUiStore } from '@/stores/ui'
import { isActive, NAV, NAV_GROUPS, type NavItem } from './nav'
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
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-solid px-1 text-[11px] font-medium text-text-on-accent tabular-nums',
        className,
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="AgentOps, home" className={cn('inline-flex h-8 items-center rounded-lg', className)}>
      <BrandWordmark />
    </Link>
  )
}

/** Toggle with `[` like most desktop tools, unless the user is typing. */
function useSidebarShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
}

/** First focusable element on every page: jumps past the navigation. */
function SkipLink() {
  return (
    <a
      href="#main"
      className="fixed top-2 start-2 z-[60] -translate-y-16 rounded-full bg-ink px-4 py-2 text-13 font-medium text-text-on-ink transition-transform duration-150 focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  )
}

/** A client-side route change resets nothing: move focus to the new view, except on first load. */
function useFocusMainOnNavigate(pathname: string) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
}

function navTestId(item: NavItem) {
  return `nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`
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
  useFocusMainOnNavigate(pathname)

  if (isDesktop) {
    return (
      <>
        <SkipLink />
        <DesktopShell pathname={pathname} badgeFor={badgeFor}>
          {children}
        </DesktopShell>
      </>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SkipLink />
      {!immersive && (
        <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-bg pe-1.5 ps-4 pt-[env(safe-area-inset-top)]">
          <Wordmark />
          <div className="flex-1" />
          <ConnectionStatus quiet compact className="px-2" />
          <NotificationBell />
          <UserMenu compact />
        </header>
      )}
      <main className="relative min-h-0 flex-1 overflow-y-auto outline-none" id="main" tabIndex={-1}>
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
                {n > 0 && <Count n={n} className="absolute top-1.5 left-1/2 ms-1.5" />}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

function DesktopShell({ pathname, badgeFor, children }: { pathname: string; badgeFor: (i: NavItem) => number; children: ReactNode }) {
  const role = useAuthStore((s) => s.user?.role) ?? 'OPERATOR'
  const hidden = useUiStore((s) => s.sidebarHidden)
  const toggleStore = useUiStore((s) => s.toggleSidebar)
  // The sidebar collapses to nothing, then the floating pill appears in its corner; opening
  // reverses it. `closing` keeps the sidebar mounted while it shrinks, so the two never coexist
  // in the DOM for long. Nothing animates on first load: only after a toggle.
  const [closing, setClosing] = useState(false)
  const [animated, setAnimated] = useState(false)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const toggle = useCallback(() => {
    setAnimated(true)
    if (!hidden && !reduced) {
      setClosing(true)
      setTimeout(() => setClosing(false), 260)
    }
    toggleStore()
  }, [hidden, reduced, toggleStore])
  useSidebarShortcut(toggle)
  const groups = NAV_GROUPS[role]
  const showAside = !hidden || closing

  return (
    <div className="flex h-dvh overflow-hidden">
      {showAside && (
        <aside
          className={cn(
            'shrink-0 overflow-hidden bg-bg-subtle',
            'transition-[width] duration-[240ms] ease-(--ease-drawer) motion-reduce:transition-none',
            hidden ? 'w-0' : 'w-60',
            animated && 'starting:w-0',
          )}
          aria-label="Main navigation"
          data-testid="sidebar"
          inert={hidden}
        >
          <div
            className={cn(
              'flex h-full w-60 flex-col transition-opacity duration-150 motion-reduce:transition-none',
              hidden ? 'opacity-0' : 'opacity-100',
              animated && 'starting:opacity-0',
            )}
          >
            <div className="flex h-16 items-center justify-between ps-5 pe-3">
              <Wordmark />
              <Tooltip label="Hide sidebar  [">
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Hide sidebar"
                  data-testid="sidebar-hide"
                  className="pressable inline-flex size-8 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-muted hover:text-text"
                >
                  <PanelLeftClose className="size-4" strokeWidth={1.75} />
                </button>
              </Tooltip>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-2 pb-4">
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 px-3 text-xs font-medium text-text-tertiary">{g.label}</p>
                  <ul className="space-y-0.5">
                    {g.items.map((item) => {
                      const active = isActive(pathname, item)
                      const Icon = item.icon
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            data-testid={navTestId(item)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex h-9 items-center gap-2.5 rounded-full px-3 text-sm transition-colors duration-100',
                              active
                                ? 'bg-bg-surface font-medium text-text shadow-border'
                                : 'text-text-secondary hover:bg-bg-muted hover:text-text',
                            )}
                          >
                            <Icon className={cn('size-4', active ? 'text-text' : 'text-text-tertiary')} strokeWidth={active ? 2 : 1.75} />
                            <span className="flex-1">{item.label}</span>
                            <Count n={badgeFor(item)} />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="space-y-1 p-3">
              <ConnectionStatus quiet className="h-8 px-3 text-xs" />
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <UserMenu />
                </div>
                <NotificationBell />
              </div>
            </div>
          </div>
        </aside>
      )}

      {hidden && !closing && (
        <div
          className={cn(
            'fixed top-3 start-3 z-40 flex origin-top-left flex-col items-center gap-1 rounded-full bg-bg-surface/90 p-1 shadow-overlay backdrop-blur-md',
            animated && 'animate-pill-in',
          )}
          aria-label="Main navigation"
          role="navigation"
          data-testid="floating-controls"
        >
          <Tooltip label="Show sidebar  [">
            <button
              type="button"
              onClick={toggle}
              aria-label="Show sidebar"
              data-testid="sidebar-show"
              className="pressable inline-flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-muted hover:text-text"
            >
              <PanelLeftOpen className="size-4" strokeWidth={1.75} />
            </button>
          </Tooltip>
          <span className="my-0.5 h-px w-5 bg-separator" aria-hidden />
          {groups
            .flatMap((g) => g.items)
            .map((item) => {
              const active = isActive(pathname, item)
              const Icon = item.icon
              const n = badgeFor(item)
              return (
                <Tooltip key={item.to} label={item.label}>
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    data-testid={navTestId(item)}
                    className={cn(
                      'pressable relative inline-flex size-9 items-center justify-center rounded-full transition-colors duration-100',
                      active ? 'bg-ink text-text-on-ink' : 'text-text-secondary hover:bg-bg-muted hover:text-text',
                    )}
                  >
                    <Icon className="size-4" strokeWidth={active ? 2 : 1.75} />
                    {n > 0 && <span className="absolute top-1 end-1 size-2 rounded-full bg-accent-solid ring-2 ring-bg-surface" />}
                  </Link>
                </Tooltip>
              )
            })}
          <span className="my-0.5 h-px w-5 bg-separator" aria-hidden />
          <NotificationBell />
          <UserMenu compact />
          <ConnectionStatus quiet compact className="px-2 py-1" />
        </div>
      )}

      <main
        className={cn(
          'relative min-h-0 min-w-0 flex-1 overflow-y-auto outline-none transition-[padding] duration-[240ms] ease-(--ease-drawer) motion-reduce:transition-none',
          hidden && 'ps-14',
        )}
        id="main"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  )
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 py-5 sm:px-8 sm:py-8', className)}>{children}</div>
}
