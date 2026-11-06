import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { upsertServerMessage, updateByClientId } from '@/features/messaging/cache'
import type { ChatMessage } from '@/features/messaging/types'
import { useRealtimeStore } from '@/stores/realtime'
import { qk } from './query-keys'
import type { RunStatus, UserDto } from './types'
import type { ServerEvent } from './ws-events'
import { actionLabel, approvalStatusLabel, riskLabel, runStatusLabel } from './labels'

export interface HandlerDeps {
  qc: QueryClient
  me: UserDto
  navigate: (href: string) => void
}

const TYPING_TTL_MS = 6000
const typingTimers = new Map<number, ReturnType<typeof setTimeout>>()

const NOTABLE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set(['AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED'])

function usernameOf(qc: QueryClient, id: number): string {
  return qc.getQueryData<UserDto[]>(qk.users)?.find((u) => u.id === id)?.username ?? `user #${id}`
}

/** Invalidate everything that may have changed while we were disconnected. */
export function invalidateOnConnect(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.users })
  void qc.invalidateQueries({ queryKey: qk.conversations })
  void qc.invalidateQueries({ queryKey: qk.runs })
  void qc.invalidateQueries({ queryKey: qk.approvals })
  void qc.invalidateQueries({ queryKey: qk.cases })
}

export function handleServerEvent(event: ServerEvent, { qc, me, navigate }: HandlerDeps) {
  const rt = useRealtimeStore.getState()

  switch (event.type) {
    case 'message': {
      const other = event.expediteurId === me.id ? event.destinataireId : event.expediteurId
      const key = qk.conversation(other)
      if (qc.getQueryData(key)) {
        qc.setQueryData<ChatMessage[]>(key, (old) => upsertServerMessage(old, event))
      }
      if (event.expediteurId !== me.id) {
        // a message implies the sender stopped typing
        clearTyping(event.expediteurId)
        if (rt.activeConversation !== other) {
          rt.incrementUnread(other)
          const name = usernameOf(qc, other)
          toast(`New message from ${name}`, {
            id: `msg-${other}`,
            description: event.contenu.length > 80 ? `${event.contenu.slice(0, 80)}…` : event.contenu,
            action: { label: 'Open', onClick: () => navigate(`/messages/${other}`) },
          })
        }
      }
      return
    }

    case 'user_presence': {
      const users = qc.getQueryData<UserDto[]>(qk.users)
      if (!users || !users.some((u) => u.id === event.userId)) {
        void qc.invalidateQueries({ queryKey: qk.users })
        return
      }
      qc.setQueryData<UserDto[]>(qk.users, (old) =>
        old?.map((u) => (u.id === event.userId ? { ...u, online: event.online } : u)),
      )
      // A users request already in flight was answered from a snapshot taken
      // before this event; it would overwrite the fresher status. Cancel and refetch.
      if (qc.isFetching({ queryKey: qk.users }) > 0) {
        void qc.invalidateQueries({ queryKey: qk.users })
      }
      if (!event.online) clearTyping(event.userId)
      return
    }

    case 'typing': {
      if (event.expediteurId === me.id) return
      if (event.isTyping) {
        rt.setTyping(event.expediteurId, true)
        const prev = typingTimers.get(event.expediteurId)
        if (prev) clearTimeout(prev)
        typingTimers.set(
          event.expediteurId,
          setTimeout(() => clearTyping(event.expediteurId), TYPING_TTL_MS),
        )
      } else {
        clearTyping(event.expediteurId)
      }
      return
    }

    case 'agent_status': {
      void qc.invalidateQueries({ queryKey: qk.runs })
      void qc.invalidateQueries({ queryKey: qk.case(event.caseId) })
      void qc.invalidateQueries({ queryKey: qk.cases })
      void qc.invalidateQueries({ queryKey: qk.audit })
      if (me.role === 'OPERATOR' && NOTABLE_RUN_STATUSES.has(event.status)) {
        const fn = event.status === 'FAILED' ? toast.error : event.status === 'COMPLETED' ? toast.success : toast.info
        fn(`Run #${event.runId} · ${runStatusLabel(event.status)}`, {
          id: `run-${event.runId}-${event.status}`,
          action: { label: 'View', onClick: () => navigate(`/operator/runs/${event.runId}`) },
        })
      }
      return
    }

    case 'approval_requested': {
      void qc.invalidateQueries({ queryKey: qk.approvals })
      void qc.invalidateQueries({ queryKey: qk.runs })
      const iAmRequester = event.requestedBy === me.id
      const href = iAmRequester ? `/operator/runs/${event.runId}` : `/reviewer/approvals/${event.approvalId}`
      const title = iAmRequester
        ? `Run #${event.runId} is awaiting approval`
        : `New approval request: ${event.caseTitle}`
      if (!iAmRequester) rt.markApprovalFresh(event.approvalId)
      const description = `${riskLabel(event.riskLevel)} · ${actionLabel(event.proposedAction)}`
      rt.pushNotification({
        title,
        description,
        href,
      })
      toast.warning(title, {
        id: `approval-req-${event.approvalId}`,
        description,
        action: { label: 'Open', onClick: () => navigate(href) },
      })
      return
    }

    case 'approval_resolved': {
      void qc.invalidateQueries({ queryKey: qk.approvals })
      void qc.invalidateQueries({ queryKey: qk.runs })
      void qc.invalidateQueries({ queryKey: qk.audit })
      if (event.decidedBy === me.id) return // own decision — the mutation already gave feedback
      const href = me.role === 'REVIEWER' ? `/reviewer/approvals/${event.approvalId}` : `/operator/runs/${event.runId}`
      const title = `Approval #${event.approvalId} ${approvalStatusLabel(event.status).toLowerCase()}`
      rt.pushNotification({
        title,
        description: event.decidedBy ? `by ${usernameOf(qc, event.decidedBy)}` : undefined,
        href,
      })
      const fn = event.status === 'APPROVED' ? toast.success : toast.error
      fn(title, { id: `approval-res-${event.approvalId}`, action: { label: 'View', onClick: () => navigate(href) } })
      return
    }

    case 'error': {
      if (event.clientMessageId) {
        updateByClientId(qc, event.clientMessageId, { delivery: 'failed', failureReason: event.message })
      }
      const title = event.code === 'rate_limited' ? 'Slow down — too many messages' : 'Message not delivered'
      toast.error(title, { id: `ws-error-${event.code}`, description: event.message })
      return
    }
  }
}

function clearTyping(userId: number) {
  const t = typingTimers.get(userId)
  if (t) clearTimeout(t)
  typingTimers.delete(userId)
  useRealtimeStore.getState().setTyping(userId, false)
}
