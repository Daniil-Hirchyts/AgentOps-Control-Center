import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { handleServerEvent } from './realtime-handlers'
import { qk } from './query-keys'
import type { UserDto } from './types'

const me: UserDto = { id: 1, username: 'alice', role: 'OPERATOR', online: true, createdAt: '2026-11-06T10:00:00Z' }
const bob: UserDto = { id: 2, username: 'bob', role: 'REVIEWER', online: false, createdAt: '2026-11-06T10:00:00Z' }

describe('user_presence', () => {
  it('patches the cached user list', () => {
    const qc = new QueryClient()
    qc.setQueryData(qk.users, [me, bob])
    handleServerEvent({ type: 'user_presence', userId: 2, username: 'bob', online: true }, { qc, me, navigate: vi.fn() })
    expect(qc.getQueryData<UserDto[]>(qk.users)?.find((u) => u.id === 2)?.online).toBe(true)
  })

  it('refetches when a users request is in flight, so a stale snapshot cannot overwrite the event', async () => {
    const qc = new QueryClient()
    qc.setQueryData(qk.users, [me, bob])
    let calls = 0
    // An active observer, like the contact list in the app.
    const observer = new QueryObserver<UserDto[]>(qc, {
      queryKey: qk.users,
      staleTime: Infinity,
      queryFn: async () => {
        calls += 1
        if (calls === 1) {
          // Snapshot taken before bob reconnected.
          await new Promise((r) => setTimeout(r, 20))
          return [me, { ...bob, online: false }]
        }
        return [me, { ...bob, online: true }]
      },
    })
    const unsubscribe = observer.subscribe(() => {})
    const stale = observer.refetch()
    handleServerEvent({ type: 'user_presence', userId: 2, username: 'bob', online: true }, { qc, me, navigate: vi.fn() })
    await stale.catch(() => undefined)
    await vi.waitFor(() => expect(qc.isFetching({ queryKey: qk.users })).toBe(0))
    expect(calls).toBe(2)
    expect(qc.getQueryData<UserDto[]>(qk.users)?.find((u) => u.id === 2)?.online).toBe(true)
    unsubscribe()
  })
})
