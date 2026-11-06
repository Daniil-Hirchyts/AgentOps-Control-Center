import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { callsTo, mockFetch } from '@/test/utils'
import { RegisterForm } from './register-form'

async function fill(username: string, password: string, confirm: string) {
  if (username) await userEvent.type(screen.getByTestId('register-username'), username)
  if (password) await userEvent.type(screen.getByTestId('register-password'), password)
  if (confirm) await userEvent.type(screen.getByTestId('register-confirm'), confirm)
}

describe('RegisterForm', () => {
  it('validates username, password length and confirmation', async () => {
    const fetchMock = mockFetch([])
    render(<RegisterForm onSuccess={vi.fn()} />)

    await fill('ab', 'short', 'other')
    await userEvent.click(screen.getByTestId('register-submit'))

    expect(await screen.findByText('At least 3 characters')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects forbidden username characters', async () => {
    mockFetch([])
    render(<RegisterForm onSuccess={vi.fn()} />)
    await fill('bad name!', 'longenough1', 'longenough1')
    await userEvent.click(screen.getByTestId('register-submit'))
    expect(await screen.findByText(/Only letters, digits/)).toBeInTheDocument()
  })

  it('creates a REVIEWER account', async () => {
    const created = { id: 9, username: 'erin', role: 'REVIEWER', createdAt: '2026-09-01T00:00:00Z' }
    const fetchMock = mockFetch([{ method: 'POST', path: '/api/comptes', handler: () => ({ status: 201, body: created }) }])
    const onSuccess = vi.fn()
    render(<RegisterForm onSuccess={onSuccess} />)

    await fill('erin', 'password-123', 'password-123')
    await userEvent.click(screen.getByTestId('register-role-reviewer'))
    await userEvent.click(screen.getByTestId('register-submit'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(created, 'password-123'))
    const [call] = callsTo(fetchMock, '/api/comptes', 'POST')
    expect(JSON.parse(String(call![1]!.body))).toEqual({ username: 'erin', password: 'password-123', role: 'REVIEWER' })
  })

  it('maps 409 to a username error', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/comptes',
        handler: () => ({ status: 409, body: { error: { code: 'conflict', message: 'taken' } } }),
      },
    ])
    render(<RegisterForm onSuccess={vi.fn()} />)
    await fill('alice', 'password-123', 'password-123')
    await userEvent.click(screen.getByTestId('register-submit'))
    expect(await screen.findByText('This username is already taken')).toBeInTheDocument()
  })
})
