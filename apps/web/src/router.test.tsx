import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '@/app'
import { createAppRouter } from '@/router'
import { makeUser, mockFetch, signIn, testQueryClient } from '@/test/utils'

function renderAt(path: string) {
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
  render(<App router={router} queryClient={testQueryClient()} />)
  return router
}

const emptyPage = { items: [], total: 0, limit: 200, offset: 0 }

describe('route guards', () => {
  it('redirects unauthenticated users to /login, keeping the target', async () => {
    mockFetch([])
    const router = renderAt('/operator/cases')
    expect(await screen.findByTestId('login-form')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ redirect: '/operator/cases' })
  })

  it('redirects a reviewer away from operator routes to their inbox', async () => {
    mockFetch([
      { path: '/api/approvals', handler: () => ({ body: emptyPage }) },
      { path: '/api/utilisateurs', handler: () => ({ body: [] }) },
      { method: 'POST', path: '/api/auth/ws-ticket', handler: () => ({ body: { ticket: 't', expiresIn: 30 } }) },
    ])
    signIn(makeUser({ id: 2, username: 'bob', role: 'REVIEWER' }))
    const router = renderAt('/operator')
    await waitFor(() => expect(router.state.location.pathname).toBe('/reviewer'))
    expect(await screen.findByText('Approval inbox')).toBeInTheDocument()
  })

  it('sends an authenticated user from /login to their home', async () => {
    mockFetch([
      { path: '/api/approvals', handler: () => ({ body: emptyPage }) },
      { path: '/api/agent-runs', handler: () => ({ body: emptyPage }) },
      { path: '/api/cases', handler: () => ({ body: emptyPage }) },
      { method: 'POST', path: '/api/auth/ws-ticket', handler: () => ({ body: { ticket: 't', expiresIn: 30 } }) },
    ])
    signIn(makeUser({ id: 1, username: 'alice', role: 'OPERATOR' }))
    const router = renderAt('/login')
    await waitFor(() => expect(router.state.location.pathname).toBe('/operator'))
  })
})
