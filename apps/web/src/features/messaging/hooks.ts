import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { useRealtime } from '@/lib/realtime-context'
import type { Id, MessageDto, UserDto } from '@/lib/types'
import { localIsoNoZone, uuid } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { appendOptimistic, removeByClientId, updateByClientId } from './cache'
import { rememberOnline } from './seen'
import type { ChatMessage } from './types'

export const SEND_ACK_TIMEOUT_MS = 10_000
const TYPING_IDLE_MS = 3_000

export function useUsers() {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => {
      const users = await api.users()
      rememberOnline(users.filter((u) => u.online).map((u) => u.id))
      return users
    },
    staleTime: 30_000,
  })
}

export function useContacts() {
  const meId = useAuthStore((s) => s.user?.id)
  const query = useUsers()
  const contacts: UserDto[] = (query.data ?? [])
    .filter((u) => u.id !== meId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username))
  return { ...query, contacts }
}

/**
 * Merge a fresh REST history with local optimistic entries that the server
 * does not know about yet (still sending, or failed and awaiting retry).
 */
export function mergeHistory(server: MessageDto[], local: ChatMessage[] | undefined, meId: Id): ChatMessage[] {
  const base: ChatMessage[] = server.map((m) => ({ ...m, delivery: 'sent' }))
  if (!local) return base
  const leftovers = local.filter((m) => {
    if (m.delivery === 'failed') return true
    if (m.delivery !== 'sending') return false
    const sentAt = new Date(m.dateEnvoi).getTime() - 60_000
    // the server already has it (delivered while we were reconnecting)
    return !server.some(
      (s) => s.expediteurId === meId && s.contenu === m.contenu.trim() && new Date(s.dateEnvoi).getTime() >= sentAt,
    )
  })
  // preserve the clientMessageId of locally-known confirmed messages for reconciliation
  for (const m of base) {
    const known = local.find((l) => l.id === m.id && l.clientMessageId)
    if (known) m.clientMessageId = known.clientMessageId
  }
  return [...base, ...leftovers]
}

export const HISTORY_PAGE = 500
const MAX_HISTORY_PAGES = 40

/**
 * The whole conversation, oldest first. The API returns the newest page; older pages are read
 * with `beforeId` until a short page shows the start was reached, so a reconnect always shows
 * the complete history, not only the last page.
 */
export async function fetchFullHistory(userId: Id): Promise<MessageDto[]> {
  let all: MessageDto[] = []
  let beforeId: Id | undefined
  for (let i = 0; i < MAX_HISTORY_PAGES; i++) {
    const page = await api.messages(userId, { limit: HISTORY_PAGE, beforeId })
    all = [...page, ...all]
    if (page.length < HISTORY_PAGE) break
    beforeId = page[0]!.id
  }
  return all
}

export function useConversation(userId: Id) {
  const qc = useQueryClient()
  const meId = useAuthStore((s) => s.user?.id ?? -1)
  return useQuery({
    queryKey: qk.conversation(userId),
    queryFn: async () => {
      const server = await fetchFullHistory(userId)
      return mergeHistory(server, qc.getQueryData<ChatMessage[]>(qk.conversation(userId)), meId)
    },
    staleTime: 15_000,
  })
}

let optimisticSeq = 0

export function useSendMessage(otherUserId: Id) {
  const qc = useQueryClient()
  const { send } = useRealtime()
  const me = useAuthStore((s) => s.user)

  const sendText = useCallback(
    (raw: string): boolean => {
      const contenu = raw.trim()
      if (!me || !contenu) return false
      const clientMessageId = uuid()
      const optimistic: ChatMessage = {
        id: -(++optimisticSeq),
        expediteurId: me.id,
        destinataireId: otherUserId,
        contenu,
        dateEnvoi: new Date().toISOString(),
        clientMessageId,
        delivery: 'sending',
      }
      appendOptimistic(qc, otherUserId, optimistic)
      const ok = send({
        type: 'message',
        destinataireId: otherUserId,
        contenu,
        clientMessageId,
        expediteurId: me.id,
        dateEnvoi: localIsoNoZone(),
      })
      if (!ok) {
        updateByClientId(qc, clientMessageId, { delivery: 'failed', failureReason: 'Not connected' })
      } else {
        setTimeout(() => {
          updateByClientId(
            qc,
            clientMessageId,
            { delivery: 'failed', failureReason: 'No confirmation from server' },
            true,
          )
        }, SEND_ACK_TIMEOUT_MS)
      }
      return ok
    },
    [me, otherUserId, qc, send],
  )

  const retry = useCallback(
    (msg: ChatMessage) => {
      if (msg.clientMessageId) removeByClientId(qc, otherUserId, msg.clientMessageId)
      sendText(msg.contenu)
    },
    [otherUserId, qc, sendText],
  )

  const discard = useCallback(
    (msg: ChatMessage) => {
      if (msg.clientMessageId) removeByClientId(qc, otherUserId, msg.clientMessageId)
    },
    [otherUserId, qc],
  )

  return { sendText, retry, discard }
}

/** Emits debounced typing start/stop frames for the given conversation. */
export function useTypingEmitter(otherUserId: Id) {
  const { send } = useRealtime()
  const typingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    if (typingRef.current) {
      typingRef.current = false
      send({ type: 'typing', destinataireId: otherUserId, isTyping: false })
    }
  }, [otherUserId, send])

  const ping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = send({ type: 'typing', destinataireId: otherUserId, isTyping: true })
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(stop, TYPING_IDLE_MS)
  }, [otherUserId, send, stop])

  useEffect(() => stop, [stop])

  return { ping, stop }
}
