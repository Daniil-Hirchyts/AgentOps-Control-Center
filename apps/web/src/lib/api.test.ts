import { describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { callsTo, makeUser, mockFetch, signIn } from '@/test/utils'
import { api, ApiError, setAuthFailureHandler } from './api'

describe('api client', () => {
  it('adds the bearer token and parses the contract error shape', async () => {
    signIn(makeUser({ id: 1, username: 'alice' }))
    const fetchMock = mockFetch([
      { path: '/api/cases/9', handler: () => ({ status: 404, body: { error: { code: 'not_found', message: 'Case not found' } } }) },
    ])
    const err = await api.case(9).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 404, code: 'not_found', message: 'Case not found' })
    expect((fetchMock.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    signIn(makeUser({ id: 1, username: 'alice' }))
    const fetchMock = mockFetch([
      {
        path: '/api/auth/me',
        handler: ({ init }) =>
          (init?.headers as Record<string, string>).Authorization === 'Bearer fresh'
            ? { body: makeUser({ id: 1, username: 'alice' }) }
            : { status: 401, body: { error: { code: 'unauthorized', message: 'expired' } } },
      },
      {
        method: 'POST',
        path: '/api/auth/refresh',
        handler: () => ({
          body: { accessToken: 'fresh', tokenType: 'Bearer', expiresIn: 900, user: makeUser({ id: 1, username: 'alice' }) },
        }),
      },
    ])
    const me = await api.me()
    expect(me.username).toBe('alice')
    const [refresh] = callsTo(fetchMock, '/api/auth/refresh', 'POST')
    expect(refresh![1]).toMatchObject({ credentials: 'include', headers: { 'X-Requested-With': 'agentops' } })
    expect(useAuthStore.getState().accessToken).toBe('fresh')
  })

  it('logs out when the refresh fails', async () => {
    signIn(makeUser({ id: 1, username: 'alice' }))
    const onFail = vi.fn()
    setAuthFailureHandler(onFail)
    mockFetch([
      { path: '/api/auth/me', handler: () => ({ status: 401, body: { error: { code: 'unauthorized', message: 'x' } } }) },
      { method: 'POST', path: '/api/auth/refresh', handler: () => ({ status: 401, body: { error: { code: 'unauthorized', message: 'x' } } }) },
    ])
    await expect(api.me()).rejects.toBeInstanceOf(ApiError)
    expect(onFail).toHaveBeenCalledOnce()
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null, user: null })
    setAuthFailureHandler(null)
  })
})
