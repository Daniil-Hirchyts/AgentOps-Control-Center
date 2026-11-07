/**
 * Dev-only state gallery: every pipeline state rendered with mock data, so each state can be
 * designed and checked side by side (registered only when `import.meta.env.DEV`).
 */
import { useState } from 'react'
import { PipelineMachine } from '@/features/agents/pipeline-machine'
import { PipelineTrack } from '@/features/agents/pipeline-track'
import type { AgentRunDto, RunStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const invoice = {
  amount: 48750,
  currency: 'EUR',
  description: 'Express freight services, October (synthetic demo data)',
  historicalAverage: 4200,
  invoiceNumber: 'INV-2026-0481',
  issueDate: '2026-10-28',
  vendor: 'Northwind Logistics GmbH',
}

const approvalBase = {
  id: 1,
  agentRunId: 1,
  caseId: 1,
  caseTitle: 'Northwind Logistics — unusual freight invoice',
  createdAt: '2026-11-06T13:13:00Z',
  invoice,
  proposedAction: 'flag_invoice_for_review' as const,
  reasoningSummary: 'Amount is 11.6x the historical average.',
  requestedBy: 1,
  requestedByUsername: 'alice',
  reviewerId: 2,
  reviewerUsername: 'bob',
  riskLevel: 'high' as const,
}

const output = { riskLevel: 'high' as const, recommendedAction: 'flag_invoice_for_review' as const, requiresApproval: true, reasoningSummary: '…' }

export const MOCK_RUNS: Record<string, AgentRunDto> = {
  queued: run('PENDING'),
  analyzing: run('RUNNING'),
  awaiting: run('AWAITING_APPROVAL', { output, approval: { ...approvalBase, status: 'PENDING' } }),
  approved: run('APPROVED', { output, approval: { ...approvalBase, status: 'APPROVED', decidedBy: 2, decidedAt: '2026-11-06T13:20:00Z' } }),
  executing: run('RUNNING', { output, approval: { ...approvalBase, status: 'APPROVED', decidedBy: 2 } }),
  completed: run('COMPLETED', { output, approval: { ...approvalBase, status: 'APPROVED', decidedBy: 2 } }),
  'no action': run('COMPLETED', { output: { riskLevel: 'low', recommendedAction: 'no_action', requiresApproval: false, reasoningSummary: '…' } }),
  rejected: run('REJECTED', { output, approval: { ...approvalBase, status: 'REJECTED', decidedBy: 2 } }),
  cancelled: run('CANCELLED', { output, approval: { ...approvalBase, status: 'REJECTED', decidedBy: 2 } }),
  failed: run('FAILED', { error: 'Model returned invalid JSON twice' }),
}

function run(status: RunStatus, extra: Partial<AgentRunDto> = {}): AgentRunDto {
  return {
    id: 1,
    attempts: 1,
    caseId: 1,
    caseTitle: 'Northwind Logistics — unusual freight invoice',
    createdAt: '2026-11-06T13:13:00Z',
    updatedAt: '2026-11-06T13:13:00Z',
    createdBy: 1,
    inputSnapshot: invoice,
    llmMode: 'mock',
    modelIdentifier: 'mock-invoice-analyst-v1',
    reviewerId: 2,
    status,
    ...extra,
  }
}

export function DevStatesPage() {
  const keys = Object.keys(MOCK_RUNS)
  const [key, setKey] = useState('awaiting')
  const [dark, setDark] = useState(false)
  const r = MOCK_RUNS[key]!
  return (
    <div className={cn('min-h-dvh bg-bg p-6 text-text', dark && 'dark')}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              className={cn('rounded-md px-2.5 py-1 text-13', k === key ? 'bg-accent-solid text-text-on-accent' : 'bg-bg-muted')}
            >
              {k}
            </button>
          ))}
          <button type="button" onClick={() => setDark((d) => !d)} className="ms-auto rounded-md bg-bg-muted px-2.5 py-1 text-13">
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
        <div className="surface rounded-xl p-4">
          <PipelineMachine run={{ ...r, id: 1 }} />
        </div>
        <div className="surface rounded-xl p-4">
          <PipelineTrack run={r} />
        </div>
        <div className="grid gap-3">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-4">
              <span className="w-24 text-13 text-text-secondary">{k}</span>
              <PipelineTrack run={MOCK_RUNS[k]!} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
