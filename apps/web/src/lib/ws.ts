import { type ClientFrame, parseServerEvent, type ServerEvent } from './ws-events'

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface RealtimeClientOptions {
  /** Fetch a fresh short-lived ticket (POST /api/auth/ws-ticket). Called before every (re)connect. */
  getTicket: () => Promise<string>
  onEvent: (event: ServerEvent) => void
  onStatus?: (status: WsStatus) => void
  /** Fired on every successful open (first connect and reconnects). */
  onOpen?: (info: { reconnect: boolean }) => void
  /** Build the socket URL; defaults to same-origin `/ws/messages`. */
  buildUrl?: (ticket: string) => string
  WebSocketImpl?: typeof WebSocket
  /** Backoff tuning (ms). */
  baseDelay?: number
  maxDelay?: number
  random?: () => number
}

export function defaultWsUrl(ticket: string): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/ws/messages?ticket=${encodeURIComponent(ticket)}`
}

export function backoffDelay(attempt: number, base = 500, max = 15_000, random: () => number = Math.random): number {
  const exp = Math.min(max, base * 2 ** attempt)
  // full jitter in [exp/2, exp]
  return Math.round(exp / 2 + (random() * exp) / 2)
}

/**
 * Native-WebSocket client with ticket auth, Zod-validated events and
 * exponential-backoff reconnects (a fresh ticket is fetched every time).
 */
export class RealtimeClient {
  private ws: WebSocket | null = null
  private attempt = 0
  private stopped = true
  private hasConnectedOnce = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private status: WsStatus = 'idle'
  private readonly opts: Required<Omit<RealtimeClientOptions, 'onStatus' | 'onOpen'>> &
    Pick<RealtimeClientOptions, 'onStatus' | 'onOpen'>

  constructor(opts: RealtimeClientOptions) {
    this.opts = {
      buildUrl: defaultWsUrl,
      WebSocketImpl: WebSocket,
      baseDelay: 500,
      maxDelay: 15_000,
      random: Math.random,
      ...opts,
    }
  }

  get currentStatus(): WsStatus {
    return this.status
  }

  get isOpen(): boolean {
    return this.ws?.readyState === this.opts.WebSocketImpl.OPEN
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.attempt = 0
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const ws = this.ws
    this.ws = null
    if (ws) {
      ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null
      try {
        ws.close(1000, 'client closing')
      } catch {
        /* ignore */
      }
    }
    this.setStatus('idle')
  }

  /** Reconnect immediately (e.g. browser came back online). */
  reconnectNow(): void {
    if (this.stopped || this.isOpen) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.attempt = 0
    void this.connect()
  }

  /** Returns false when the socket is not open (caller should mark the message failed). */
  send(frame: ClientFrame): boolean {
    if (!this.ws || !this.isOpen) return false
    try {
      this.ws.send(JSON.stringify(frame))
      return true
    } catch {
      return false
    }
  }

  private setStatus(s: WsStatus) {
    if (this.status === s) return
    this.status = s
    this.opts.onStatus?.(s)
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    this.setStatus(this.hasConnectedOnce || this.attempt > 0 ? 'reconnecting' : 'connecting')
    let ticket: string
    try {
      ticket = await this.opts.getTicket()
    } catch {
      this.scheduleReconnect()
      return
    }
    if (this.stopped) return

    let ws: WebSocket
    try {
      ws = new this.opts.WebSocketImpl(this.opts.buildUrl(ticket))
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      const reconnect = this.hasConnectedOnce
      this.hasConnectedOnce = true
      this.attempt = 0
      this.setStatus('connected')
      this.opts.onOpen?.({ reconnect })
    }
    ws.onmessage = (ev: MessageEvent) => {
      const result = parseServerEvent(ev.data)
      if (result.ok) {
        this.opts.onEvent(result.event)
      } else if (result.reason !== 'unknown_type' && import.meta.env.DEV) {
        console.warn('[ws] dropped invalid frame', result)
      }
    }
    ws.onerror = () => {
      // onclose follows; nothing to do here
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return
    this.setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'reconnecting')
    const delay = backoffDelay(this.attempt, this.opts.baseDelay, this.opts.maxDelay, this.opts.random)
    this.attempt += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.connect()
    }, delay)
  }
}
