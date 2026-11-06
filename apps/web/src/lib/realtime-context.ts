import { createContext, useContext } from 'react'
import type { ClientFrame } from './ws-events'

export interface RealtimeApi {
  /** Send a frame; returns false when the socket is not open. */
  send: (frame: ClientFrame) => boolean
}

export const RealtimeContext = createContext<RealtimeApi>({ send: () => false })

export function useRealtime(): RealtimeApi {
  return useContext(RealtimeContext)
}
