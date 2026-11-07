import { useQueryClient } from '@tanstack/react-query'
import { recordFrame } from '@/stores/traffic'
import { useRouter } from '@tanstack/react-router'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { api } from '@/lib/api'
import { RealtimeContext, type RealtimeApi } from '@/lib/realtime-context'
import { handleServerEvent, invalidateOnConnect } from '@/lib/realtime-handlers'
import { RealtimeClient } from '@/lib/ws'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'

/** Owns the single WebSocket connection for the signed-in user. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const router = useRouter()
  const userId = useAuthStore((s) => s.user?.id)
  const clientRef = useRef<RealtimeClient | null>(null)

  useEffect(() => {
    if (userId === undefined) return
    const setStatus = useRealtimeStore.getState().setWsStatus
    const client = new RealtimeClient({
      getTicket: async () => (await api.wsTicket()).ticket,
      onStatus: setStatus,
      onOpen: () => invalidateOnConnect(qc),
      onEvent: (event) => {
        recordFrame({ channel: 'ws', dir: 'in', label: event.type, detail: event.type === 'agent_status' ? event.status : undefined })
        const me = useAuthStore.getState().user
        if (!me) return
        handleServerEvent(event, { qc, me, navigate: (href) => router.history.push(href) })
      },
    })
    clientRef.current = client
    client.start()

    const onOnline = () => client.reconnectNow()
    const onVisible = () => {
      if (document.visibilityState === 'visible') client.reconnectNow()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      client.stop()
      clientRef.current = null
    }
  }, [userId, qc, router])

  const value = useMemo<RealtimeApi>(() => ({ send: (frame) => {
        const ok = clientRef.current?.send(frame) ?? false
        if (ok) recordFrame({ channel: 'ws', dir: 'out', label: frame.type })
        return ok
      }, }), [])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
