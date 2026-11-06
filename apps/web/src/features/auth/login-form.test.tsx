import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { callsTo, makeUser, mockFetch } from '@/test/utils'
import { LoginForm } from './login-form'

const session = {
  accessToken: 'jwt',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: makeUser({ id: 1, username: 'alice' }),
}

describe('LoginForm', () => {
  it('shows validation errors and does not call the API when empty', async () => {
    const fetchMock = mockFetch([])
    const onSuccess = vi.fn()
    render(<LoginForm onSuccess={onSuccess} />)

    await userEvent.click(screen.getByTestId('login-submit'))

    expect(await screen.findByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(screen.getByTestId('login-username')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('submits credentials and reports the session', async () => {
    const fetchMock = mockFetch([{ method: 'POST', path: '/api/auth/login', handler: () => ({ body: session }) }])
    const onSuccess = vi.fn()
    render(<LoginForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByTestId('login-username'), 'alice')
    await userEvent.type(screen.getByTestId('login-password'), 'demo-password-123')
    await userEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(session))
    const [call] = callsTo(fetchMock, '/api/auth/login', 'POST')
    expect(JSON.parse(String(call![1]!.body))).toEqual({ username: 'alice', password: 'demo-password-123' })
    // login must not carry a bearer token
    expect((call![1]!.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('shows a friendly error on 401 without attempting a token refresh', async () => {
    const fetchMock = mockFetch([
      {
        method: 'POST',
        path: '/api/auth/login',
        handler: () => ({ status: 401, body: { error: { code: 'unauthorized', message: 'bad credentials' } } }),
      },
    ])
    render(<LoginForm onSuccess={vi.fn()} />)

    await userEvent.type(screen.getByTestId('login-username'), 'alice')
    await userEvent.type(screen.getByTestId('login-password'), 'wrong-password')
    await userEvent.click(screen.getByTestId('login-submit'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Invalid username or password')
    expect(callsTo(fetchMock, '/api/auth/refresh', 'POST')).toHaveLength(0)
  })

  it('fills demo credentials from the hint', async () => {
    mockFetch([])
    render(<LoginForm onSuccess={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /bob/ }))
    expect(screen.getByTestId('login-username')).toHaveValue('bob')
    expect(screen.getByTestId('login-password')).toHaveValue('demo-password-123')
  })
})
