import type { QueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import type { Id, MessageDto } from '@/lib/types'
import type { ChatMessage } from './types'

/**
 * Insert a confirmed server message into a conversation cache.
 * - reconciles the optimistic copy (same clientMessageId) in place
 * - dedupes by server id
 * - keeps still-pending optimistic messages at the end
 */
export function upsertServerMessage(
  list: ChatMessage[] | undefined,
  msg: MessageDto & { clientMessageId?: string | null },
): ChatMessage[] | undefined {
  if (!list) return list
  const confirmed: ChatMessage = {
    id: msg.id,
    expediteurId: msg.expediteurId,
    destinataireId: msg.destinataireId,
    contenu: msg.contenu,
    dateEnvoi: msg.dateEnvoi,
    clientMessageId: msg.clientMessageId ?? undefined,
    delivery: 'sent',
  }
  if (msg.clientMessageId) {
    const idx = list.findIndex((m) => m.clientMessageId === msg.clientMessageId)
    if (idx !== -1) {
      const next = list.slice()
      next[idx] = confirmed
      return next.filter((m, i) => i === idx || m.id !== msg.id)
    }
  }
  if (list.some((m) => m.id === msg.id)) return list
  const firstPending = list.findIndex((m) => m.delivery === 'sending' || m.delivery === 'failed')
  if (firstPending === -1) return [...list, confirmed]
  return [...list.slice(0, firstPending), confirmed, ...list.slice(firstPending)]
}

export function appendOptimistic(qc: QueryClient, otherUserId: Id, msg: ChatMessage) {
  qc.setQueryData<ChatMessage[]>(qk.conversation(otherUserId), (old) => [...(old ?? []), msg])
}

export function updateByClientId(
  qc: QueryClient,
  clientMessageId: string,
  patch: Partial<ChatMessage>,
  onlyIfSending = false,
): boolean {
  let hit = false
  for (const [key, list] of qc.getQueriesData<ChatMessage[]>({ queryKey: qk.conversations })) {
    if (!list) continue
    const idx = list.findIndex((m) => m.clientMessageId === clientMessageId)
    if (idx === -1) continue
    const current = list[idx]!
    if (onlyIfSending && current.delivery !== 'sending') continue
    hit = true
    const next = list.slice()
    next[idx] = { ...current, ...patch }
    qc.setQueryData(key, next)
  }
  return hit
}

export function removeByClientId(qc: QueryClient, otherUserId: Id, clientMessageId: string) {
  qc.setQueryData<ChatMessage[]>(qk.conversation(otherUserId), (old) =>
    old?.filter((m) => m.clientMessageId !== clientMessageId),
  )
}
