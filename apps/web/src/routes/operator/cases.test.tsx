import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CaseDto } from '@/lib/types'
import { makeUser, mockFetch, renderWithProviders, signIn } from '@/test/utils'
import { CasesPage } from './cases'

const sample: CaseDto = {
  id: 3,
  title: 'Unusual consulting invoice',
  invoice: {
    invoiceNumber: 'INV-1',
    vendor: 'Northwind',
    amount: 48250,
    currency: 'EUR',
    issueDate: '2026-09-12',
    description: '',
  },
  status: 'FLAGGED_FOR_REVIEW',
  createdBy: 1,
  createdAt: '2026-09-21T10:15:30Z',
  updatedAt: '2026-09-21T10:15:30Z',
}

describe('CasesPage list states', () => {
  it('shows a loading skeleton while fetching', async () => {
    signIn(makeUser({ id: 1, username: 'alice' }))
    mockFetch([{ path: '/api/cases', handler: () => 'pending' }])
    renderWithProviders(<CasesPage />)
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument()
  })

  it('shows an error with retry, then the data', async () => {
    signIn(makeUser({ id: 1, username: 'alice' }))
    let fail = true
    mockFetch([
      {
        path: '/api/cases',
        handler: () =>
          fail
            ? { status: 500, body: { error: { code: 'internal', message: 'Database unavailable' } } }
            : { body: { items: [sample], total: 1, limit: 200, offset: 0 } },
      },
    ])
    renderWithProviders(<CasesPage />)
    const err = await screen.findByTestId('error-state')
    expect(err).toHaveTextContent('Database unavailable')

    fail = false
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Unusual consulting invoice')).toBeInTheDocument()
    expect(screen.getByTestId('case-status')).toHaveTextContent('Flagged for review')
    await waitFor(() => expect(screen.queryByTestId('error-state')).not.toBeInTheDocument())
  })

  it('shows an empty state', async () => {
    signIn(makeUser({ id: 1, username: 'alice' }))
    mockFetch([{ path: '/api/cases', handler: () => ({ body: { items: [], total: 0, limit: 200, offset: 0 } }) }])
    renderWithProviders(<CasesPage />)
    expect(await screen.findByTestId('empty-state')).toHaveTextContent('No investigations yet')
  })
})
