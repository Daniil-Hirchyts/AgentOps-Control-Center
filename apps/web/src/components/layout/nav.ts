import { Inbox, LayoutGrid, type LucideIcon, MessageSquare, Play, ScrollText, FolderOpen } from 'lucide-react'
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

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to || pathname === `${item.to}/`
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
