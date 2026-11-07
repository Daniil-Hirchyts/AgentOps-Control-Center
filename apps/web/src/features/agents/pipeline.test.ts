import { describe, expect, it } from 'vitest'
import { predictRisk } from '@/features/cases/schema'
import type { AgentRunDto } from '@/lib/types'
import { boardColumnOf, currentStage, pipelineOf } from './pipeline'

type RunLike = Pick<AgentRunDto, 'status' | 'output' | 'approval' | 'error'>

const output = (requiresApproval = true): AgentRunDto['output'] => ({
  riskLevel: requiresApproval ? 'high' : 'low',
  recommendedAction: requiresApproval ? 'flag_invoice_for_review' : 'no_action',
  requiresApproval,
  reasoningSummary: 'synthetic',
})

const approval = (status: 'PENDING' | 'APPROVED' | 'REJECTED') =>
  ({ status, reviewerUsername: 'bob' }) as unknown as NonNullable<AgentRunDto['approval']>

const run = (r: Partial<RunLike> & Pick<RunLike, 'status'>): RunLike => ({ output: null, approval: null, error: null, ...r })
const states = (r: RunLike) => pipelineOf(r).map((s) => s.state)

describe('pipeline model', () => {
  it('waits at the human gate until a reviewer decides', () => {
    const r = run({ status: 'AWAITING_APPROVAL', output: output(), approval: approval('PENDING') })
    expect(states(r)).toEqual(['done', 'done', 'waiting', 'upcoming', 'upcoming'])
    expect(currentStage(r)).toBe('review')
    expect(pipelineOf(r)[2]!.detail).toBe('Waiting on bob')
  })

  it('stops at review on rejection and never reaches execute', () => {
    const r = run({ status: 'CANCELLED', output: output(), approval: approval('REJECTED') })
    expect(states(r)).toEqual(['done', 'done', 'stopped', 'skipped', 'done'])
    expect(currentStage(r)).toBe('review')
  })

  it('skips review and execute when nothing needs approval', () => {
    const r = run({ status: 'COMPLETED', output: output(false) })
    expect(states(r)).toEqual(['done', 'done', 'skipped', 'skipped', 'done'])
    expect(currentStage(r)).toBe('done')
  })

  it('marks a failed analysis and runs nothing after it', () => {
    const r = run({ status: 'FAILED', error: 'timeout' })
    expect(states(r)).toEqual(['done', 'failed', 'skipped', 'skipped', 'done'])
    expect(currentStage(r)).toBe('analyze')
  })

  it('puts every status in exactly one board column', () => {
    expect(boardColumnOf('PENDING')).toBe('queued')
    expect(boardColumnOf('AWAITING_APPROVAL')).toBe('review')
    expect(boardColumnOf('APPROVED')).toBe('executing')
    expect(boardColumnOf('FAILED')).toBe('stopped')
    expect(boardColumnOf('CANCELLED')).toBe('stopped')
  })
})

describe('risk preview', () => {
  it('mirrors the mock agent thresholds', () => {
    expect(predictRisk(48_250, 9_800)).toBe('high')
    expect(predictRisk(12_500, null)).toBe('high')
    expect(predictRisk(6_400, 5_900)).toBe('medium')
    expect(predictRisk(1_180, 1_050)).toBe('low')
    expect(predictRisk(0, null)).toBeNull()
  })
})
