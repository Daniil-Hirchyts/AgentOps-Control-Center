import { create } from 'zustand'
import type { WsStatus } from '@/lib/ws'
import type { Id } from '@/lib/types'

export interface AppNotification {
  id: string
  title: string
  description?: string
  /** In-app link target */
  href?: string
  createdAt: number
  read: boolean
}

interface RealtimeState {
  wsStatus: WsStatus
  /** userId → typing flag (ephemeral, auto-expires) */
  typing: Record<Id, boolean>
  /** userId → unread message count */
  unreadMessages: Record<Id, number>
  /** Conversation currently on screen (to avoid counting unread). */
  activeConversation: Id | null
  notifications: AppNotification[]
  /** Approval ids that arrived via WS and have not been opened yet. */
  freshApprovals: Record<Id, true>

  setWsStatus: (s: WsStatus) => void
  setTyping: (userId: Id, isTyping: boolean) => void
  incrementUnread: (userId: Id) => void
  setActiveConversation: (userId: Id | null) => void
  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markAllNotificationsRead: () => void
  markApprovalFresh: (id: Id) => void
  markApprovalSeen: (id: Id) => void
  reset: () => void
}

const initial = {
  wsStatus: 'idle' as WsStatus,
  typing: {},
  unreadMessages: {},
  activeConversation: null,
  notifications: [],
  freshApprovals: {},
}

let notifSeq = 0

export const useRealtimeStore = create<RealtimeState>()((set) => ({
  ...initial,
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setTyping: (userId, isTyping) =>
    set((s) => {
      if (Boolean(s.typing[userId]) === isTyping) return s
      const typing = { ...s.typing }
      if (isTyping) typing[userId] = true
      else delete typing[userId]
      return { typing }
    }),
  incrementUnread: (userId) =>
    set((s) =>
      s.activeConversation === userId
        ? s
        : { unreadMessages: { ...s.unreadMessages, [userId]: (s.unreadMessages[userId] ?? 0) + 1 } },
    ),
  setActiveConversation: (userId) =>
    set((s) => {
      if (userId === null) return { activeConversation: null }
      const unreadMessages = { ...s.unreadMessages }
      delete unreadMessages[userId]
      return { activeConversation: userId, unreadMessages }
    }),
  pushNotification: (n) =>
    set((s) => ({
      notifications: [{ ...n, id: `n${++notifSeq}`, createdAt: Date.now(), read: false }, ...s.notifications].slice(
        0,
        30,
      ),
    })),
  markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  markApprovalFresh: (id) => set((s) => ({ freshApprovals: { ...s.freshApprovals, [id]: true } })),
  markApprovalSeen: (id) =>
    set((s) => {
      if (!s.freshApprovals[id]) return s
      const freshApprovals = { ...s.freshApprovals }
      delete freshApprovals[id]
      return { freshApprovals }
    }),
  reset: () => set({ ...initial }),
}))

export const selectUnreadNotifications = (s: RealtimeState) => s.notifications.filter((n) => !n.read).length
export const selectTotalUnreadMessages = (s: RealtimeState) =>
  Object.values(s.unreadMessages).reduce((a, b) => a + b, 0)
