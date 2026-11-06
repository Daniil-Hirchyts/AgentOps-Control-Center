import { ClipboardCheck, FileSearch, LayoutDashboard, type LucideIcon, MessagesSquare, PlayCircle, ScrollText } from 'lucide-react'
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
    { to: '/operator', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/operator/cases', label: 'Cases', icon: FileSearch },
    { to: '/operator/runs', label: 'Runs', icon: PlayCircle },
    { to: '/operator/audit', label: 'Audit', icon: ScrollText },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, badge: 'messages' },
  ],
  REVIEWER: [
    { to: '/reviewer', label: 'Inbox', icon: ClipboardCheck, badge: 'approvals' },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, badge: 'messages' },
  ],
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to || pathname === `${item.to}/`
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
