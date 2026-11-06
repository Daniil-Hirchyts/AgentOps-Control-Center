import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { upsertServerMessage } from '@/features/messaging/cache'
import type { ChatMessage } from '@/features/messaging/types'
import { useRealtimeStore } from '@/stores/realtime'
import { FakeWebSocket } from '@/test/fake-websocket'
import { makeUser } from '@/test/utils'
import { handleServerEvent } from './realtime-handlers'
import { backoffDelay, RealtimeClient } from './ws'
import { parseServerEvent } from './ws-events'

describe('parseServerEvent', () => {
  it.each([
    { type: 'message', id: 1, expediteurId: 1, destinataireId: 2, contenu: 'hi', dateEnvoi: '2026-09-21T10:15:30Z' },
    {
      type: 'message',
      id: 1,
      expediteurId: 1,
      destinataireId: 2,
      contenu: 'hi',
      dateEnvoi: '2026-09-21T10:15:30Z',
      clientMessageId: 'abc',
    },
    { type: 'user_presence', userId: 2, username: 'bob', online: true },
    { type: 'typing', expediteurId: 1, destinataireId: 2, isTyping: true },
    { type: 'agent_status', runId: 7, caseId: 3, status: 'AWAITING_APPROVAL', updatedAt: '2026-09-21T10:15:30Z' },
    {
      type: 'approval_requested',
      approvalId: 5,
      runId: 7,
      caseId: 3,
      caseTitle: 'x',
      riskLevel: 'high',
      proposedAction: 'flag_invoice_for_review',
      requestedBy: 1,
      createdAt: '2026-09-21T10:15:30Z',
    },
    { type: 'approval_resolved', approvalId: 5, runId: 7, status: 'APPROVED', decidedBy: 2, decidedAt: '2026-09-21T10:15:30Z' },
    { type: 'error', code: 'rate_limited', message: 'slow down' },
  ])('accepts a valid $type event', (payload) => {
    const res = parseServerEvent(JSON.stringify(payload))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.event.type).toBe(payload.type)
  })

  it('rejects malformed payloads of known types', () => {
    expect(parseServerEvent({ type: 'message', id: '1', contenu: 'x' })).toMatchObject({
      ok: false,
      reason: 'invalid_payload',
    })
    expect(parseServerEvent({ type: 'agent_status', runId: 1, caseId: 1, status: 'EXPLODED', updatedAt: 'x' })).toMatchObject({
      ok: false,
      reason: 'invalid_payload',
    })
    expect(parseServerEvent({ type: 'user_presence', userId: 2, username: 'bob' })).toMatchObject({ ok: false })
  })

  it('ignores unknown event types safely', () => {
    expect(parseServerEvent({ type: 'pong', at: 1 })).toEqual({ ok: false, reason: 'unknown_type', detail: 'pong' })
  })

  it('handles non-JSON and non-object frames', () => {
    expect(parseServerEvent('{not json')).toEqual({ ok: false, reason: 'invalid_json' })
    expect(parseServerEvent('42')).toMatchObject({ ok: false, reason: 'invalid_payload' })
    expect(parseServerEvent(null)).toMatchObject({ ok: false, reason: 'invalid_payload' })
  })
})

describe('RealtimeClient', () => {
  it('connects with a ticket, validates events and reconnects with a fresh ticket', async () => {
    vi.useFakeTimers()
    let n = 0
    const getTicket = vi.fn(async () => `ticket-${++n}`)
    const onEvent = vi.fn()
    const onOpen = vi.fn()
    const statuses: string[] = []
    const client = new RealtimeClient({
      getTicket,
      onEvent,
      onOpen,
      onStatus: (s) => statuses.push(s),
      buildUrl: (t) => `ws://test/ws/messages?ticket=${t}`,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      random: () => 0,
    })
    client.start()
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    const ws1 = FakeWebSocket.last!
    expect(ws1.url).toBe('ws://test/ws/messages?ticket=ticket-1')
    ws1.serverOpen()
    expect(onOpen).toHaveBeenCalledWith({ reconnect: false })
    expect(client.currentStatus).toBe('connected')

    ws1.serverSend({ type: 'user_presence', userId: 2, username: 'bob', online: false })
    ws1.serverSend({ type: 'mystery' })
    ws1.serverSend('garbage')
    expect(onEvent).toHaveBeenCalledTimes(1)

    expect(client.send({ type: 'typing', destinataireId: 2, isTyping: true })).toBe(true)
    expect(JSON.parse(ws1.sent[0]!)).toEqual({ type: 'typing', destinataireId: 2, isTyping: true })

    ws1.serverClose()
    expect(client.currentStatus).toBe('reconnecting')
    expect(client.send({ type: 'typing', destinataireId: 2, isTyping: false })).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(getTicket).toHaveBeenCalledTimes(2)
    const ws2 = FakeWebSocket.last!
    expect(ws2).not.toBe(ws1)
    expect(ws2.url).toContain('ticket-2')
    ws2.serverOpen()
    expect(onOpen).toHaveBeenLastCalledWith({ reconnect: true })
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])

    client.stop()
    expect(client.currentStatus).toBe('idle')
  })

  it('backs off exponentially with a cap', () => {
    const r = () => 1
    expect(backoffDelay(0, 500, 15000, r)).toBe(500)
    expect(backoffDelay(1, 500, 15000, r)).toBe(1000)
    expect(backoffDelay(3, 500, 15000, r)).toBe(4000)
    expect(backoffDelay(10, 500, 15000, r)).toBe(15000)
  })
})

describe('event handling', () => {
  const me = makeUser({ id: 1, username: 'alice' })

  it('updates presence in the users cache', () => {
    const qc = new QueryClient()
    qc.setQueryData(['users'], [me, makeUser({ id: 2, username: 'bob', online: false })])
    handleServerEvent({ type: 'user_presence', userId: 2, username: 'bob', online: true }, { qc, me, navigate: vi.fn() })
    expect(qc.getQueryData<{ online: boolean }[]>(['users'])![1]!.online).toBe(true)
  })

  it('counts unread messages and approval notifications', () => {
    const qc = new QueryClient()
    handleServerEvent(
      { type: 'message', id: 5, expediteurId: 2, destinataireId: 1, contenu: 'yo', dateEnvoi: '2026-09-21T10:00:00Z' },
      { qc, me, navigate: vi.fn() },
    )
    handleServerEvent(
      {
        type: 'approval_requested',
        approvalId: 5,
        runId: 7,
        caseId: 3,
        caseTitle: 'Invoice',
        riskLevel: 'high',
        proposedAction: 'flag_invoice_for_review',
        requestedBy: 9,
        createdAt: '2026-09-21T10:15:30Z',
      },
      { qc, me, navigate: vi.fn() },
    )
    const s = useRealtimeStore.getState()
    expect(s.unreadMessages[2]).toBe(1)
    expect(s.notifications).toHaveLength(1)
    expect(s.freshApprovals[5]).toBe(true)
  })

  it('upsertServerMessage dedupes and keeps pending messages last', () => {
    const base: ChatMessage[] = [
      { id: 1, expediteurId: 1, destinataireId: 2, contenu: 'a', dateEnvoi: 't' },
      { id: -1, expediteurId: 1, destinataireId: 2, contenu: 'b', dateEnvoi: 't', clientMessageId: 'c1', delivery: 'sending' },
    ]
    const withIncoming = upsertServerMessage(base, { id: 2, expediteurId: 2, destinataireId: 1, contenu: 'x', dateEnvoi: 't' })!
    expect(withIncoming.map((m) => m.id)).toEqual([1, 2, -1])
    const reconciled = upsertServerMessage(withIncoming, {
      id: 3,
      expediteurId: 1,
      destinataireId: 2,
      contenu: 'b',
      dateEnvoi: 't',
      clientMessageId: 'c1',
    })!
    expect(reconciled.map((m) => [m.id, m.delivery])).toEqual([
      [1, undefined],
      [2, 'sent'],
      [3, 'sent'],
    ])
    expect(upsertServerMessage(reconciled, { id: 3, expediteurId: 1, destinataireId: 2, contenu: 'b', dateEnvoi: 't' })).toBe(
      reconciled,
    )
  })
})
