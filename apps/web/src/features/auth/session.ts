import type { QueryClient } from '@tanstack/react-query'
import { api, refreshSession } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'

/** On app boot: try to restore the session from the HttpOnly refresh cookie. */
export async function bootstrapSession(): Promise<void> {
  const session = await refreshSession()
  if (!session) useAuthStore.getState().markAnonymous()
}

export async function logout(qc?: QueryClient): Promise<void> {
  try {
    await api.logout()
  } catch {
    // best effort — the local session is cleared regardless
  }
  useAuthStore.getState().clear()
  useRealtimeStore.getState().reset()
  qc?.clear()
}
