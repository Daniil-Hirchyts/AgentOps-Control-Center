import { BookOpen, FolderOpen, Inbox, LayoutGrid, type LucideIcon, MessageSquare, Network, Play, ScrollText } from 'lucide-react'
import type { Role } from '@/lib/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: 'messages' | 'approvals'
}

export const NAV: Record<Role, NavItem[]> = {
  OPERATOR: [
    { to: '/operator', label: 'Overview', icon: LayoutGrid, exact: true },
    { to: '/operator/cases', label: 'Cases', icon: FolderOpen },
    { to: '/operator/runs', label: 'Runs', icon: Play },
    { to: '/operator/audit', label: 'Audit log', icon: ScrollText },
    { to: '/messages', label: 'Messages', icon: MessageSquare, badge: 'messages' },
  ],
  REVIEWER: [
    { to: '/reviewer', label: 'Inbox', icon: Inbox, badge: 'approvals' },
    { to: '/messages', label: 'Messages', icon: MessageSquare, badge: 'messages' },
  ],
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const LEARN: NavItem[] = [
  { to: '/learn/concept', label: 'Concept', icon: BookOpen },
  { to: '/learn/architecture', label: 'Architecture', icon: Network },
]

/** Desktop sidebar: the work first, then conversations and the audit trail, then the explainers. */
export const NAV_GROUPS: Record<Role, NavGroup[]> = {
  OPERATOR: [
    { label: 'Work', items: NAV.OPERATOR.filter((i) => ['/operator', '/operator/cases', '/operator/runs'].includes(i.to)) },
    { label: 'Collaborate', items: NAV.OPERATOR.filter((i) => ['/messages', '/operator/audit'].includes(i.to)) },
    { label: 'Learn', items: LEARN },
  ],
  REVIEWER: [
    { label: 'Work', items: NAV.REVIEWER.filter((i) => i.to === '/reviewer') },
    { label: 'Collaborate', items: NAV.REVIEWER.filter((i) => i.to === '/messages') },
    { label: 'Learn', items: LEARN },
  ],
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to || pathname === `${item.to}/`
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
