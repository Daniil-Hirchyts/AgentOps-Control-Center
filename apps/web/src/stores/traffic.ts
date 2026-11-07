import { create } from 'zustand'

/**
 * A short rolling log of what this browser just sent and received, REST and WebSocket alike.
 * Only the Architecture page reads it, to animate the diagrams with real traffic.
 * Nothing sensitive is kept: method, path without query, event type, status code.
 */
export type Channel = 'rest' | 'ws'

export interface Frame {
  id: number
  channel: Channel
  dir: 'out' | 'in'
  /** `GET /api/approvals`, `message`, `agent_status`… */
  label: string
  /** HTTP status for REST, run status for `agent_status`. */
  detail?: string
  at: number
}

interface TrafficState {
  frames: Frame[]
  record: (f: Omit<Frame, 'id' | 'at'>) => void
}

let seq = 0

export const useTraffic = create<TrafficState>()((set) => ({
  frames: [],
  record: (f) => set((s) => ({ frames: [{ ...f, id: ++seq, at: Date.now() }, ...s.frames].slice(0, 14) })),
}))

export const recordFrame = (f: Omit<Frame, 'id' | 'at'>) => useTraffic.getState().record(f)
