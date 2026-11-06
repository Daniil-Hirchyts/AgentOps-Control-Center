import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ApprovalDto } from '@/lib/types'
import { callsTo, makeUser, mockFetch, renderWithProviders, signIn } from '@/test/utils'
import { ApprovalDetailPage } from './approval-detail'

const bob = makeUser({ id: 2, username: 'bob', role: 'REVIEWER' })

const pending: ApprovalDto = {
  id: 5,
  agentRunId: 7,
  caseId: 3,
  caseTitle: 'Unusual consulting invoice',
  reviewerId: 2,
  reviewerUsername: 'bob',
  requestedBy: 1,
  requestedByUsername: 'alice',
  proposedAction: 'flag_invoice_for_review',
  riskLevel: 'high',
  reasoningSummary: 'Amount is 4.9x the historical average with no PO.',
  invoice: {
    invoiceNumber: 'INV-1',
    vendor: 'Northwind',
    amount: 48250,
    currency: 'EUR',
    issueDate: '2026-09-12',
    description: 'Consulting',
    historicalAverage: 9800,
  },
  status: 'PENDING',
  decisionReason: null,
  decidedBy: null,
  createdAt: '2026-09-21T10:15:30Z',
  decidedAt: null,
}

function setup(decision: { status: number; body: unknown }, afterConflict?: ApprovalDto) {
  signIn(bob)
  let current = pending
  const fetchMock = mockFetch([
    { path: '/api/approvals/5', handler: () => ({ body: current }) },
    {
      method: 'POST',
      path: '/api/approvals/5/decision',
      handler: () => {
        if (afterConflict) current = afterConflict
        else if (decision.status === 200) current = decision.body as ApprovalDto
        return decision
      },
    },
  ])
  renderWithProviders(<ApprovalDetailPage approvalId={5} />, { path: '/reviewer/approvals/5' })
  return fetchMock
}

describe('ApprovalDetailPage', () => {
  it('approves with a reason after confirmation', async () => {
    const approved = { ...pending, status: 'APPROVED', decidedBy: 2, decisionReason: 'Confirmed with vendor', decidedAt: '2026-09-21T11:00:00Z' }
    const fetchMock = setup({ status: 200, body: approved })

    expect(await screen.findByTestId('approval-reasoning')).toHaveTextContent('4.9x')
    expect(screen.getByTestId('approval-status')).toHaveTextContent('Pending')

    await userEvent.click(screen.getByTestId('approve-button'))
    expect(await screen.findByTestId('decision-dialog')).toHaveTextContent('Approve this action?')
    await userEvent.type(screen.getByTestId('decision-reason'), 'Confirmed with vendor')
    await userEvent.click(screen.getByTestId('confirm-decision'))

    await waitFor(() => expect(callsTo(fetchMock, '/api/approvals/5/decision', 'POST')).toHaveLength(1))
    const [call] = callsTo(fetchMock, '/api/approvals/5/decision', 'POST')
    expect(JSON.parse(String(call![1]!.body))).toEqual({ decision: 'approve', reason: 'Confirmed with vendor' })

    await waitFor(() => expect(screen.getAllByTestId('approval-status')[0]).toHaveTextContent('Approved'))
    expect(screen.getByTestId('approve-button')).toBeDisabled()
    expect(screen.getByTestId('reject-button')).toBeDisabled()
    expect(await screen.findByText('Action approved')).toBeInTheDocument()
  })

  it('rejects without a reason', async () => {
    const rejected = { ...pending, status: 'REJECTED', decidedBy: 2, decidedAt: '2026-09-21T11:00:00Z' }
    const fetchMock = setup({ status: 200, body: rejected })
    await userEvent.click(await screen.findByTestId('reject-button'))
    await userEvent.click(await screen.findByTestId('confirm-decision'))
    await waitFor(() => expect(callsTo(fetchMock, '/api/approvals/5/decision', 'POST')).toHaveLength(1))
    const [call] = callsTo(fetchMock, '/api/approvals/5/decision', 'POST')
    expect(JSON.parse(String(call![1]!.body))).toEqual({ decision: 'reject' })
    await waitFor(() => expect(screen.getAllByTestId('approval-status')[0]).toHaveTextContent('Rejected'))
  })

  it('handles 409 "already decided" by refreshing the approval', async () => {
    const decidedElsewhere = { ...pending, status: 'REJECTED' as const, decidedBy: 2, decidedAt: '2026-09-21T10:30:00Z' }
    const fetchMock = setup(
      { status: 409, body: { error: { code: 'conflict', message: 'approval already decided' } } },
      decidedElsewhere,
    )
    await userEvent.click(await screen.findByTestId('approve-button'))
    await userEvent.click(await screen.findByTestId('confirm-decision'))

    expect(await screen.findByText('Already decided')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('approval-status')[0]).toHaveTextContent('Rejected'))
    expect(screen.getByTestId('approve-button')).toBeDisabled()
    expect(callsTo(fetchMock, '/api/approvals/5').length).toBeGreaterThanOrEqual(2)
  })

  it('does not let a non-assigned user decide', async () => {
    signIn(makeUser({ id: 4, username: 'dave', role: 'REVIEWER' }))
    mockFetch([{ path: '/api/approvals/5', handler: () => ({ body: pending }) }])
    renderWithProviders(<ApprovalDetailPage approvalId={5} />)
    expect(await screen.findByTestId('approve-button')).toBeDisabled()
    expect(screen.getByText('Only bob can decide on this approval.')).toBeInTheDocument()
  })
})
