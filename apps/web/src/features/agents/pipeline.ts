/**
 * The agent pipeline as a pure model: one source of truth for the 2D track, the
 * isometric machine and the overview board. Derived only from the run DTO.
 *
 *   intake → analyze → review (human gate) → execute → done
 *
 * Terminal branches: analysis fails at `analyze`; a rejection stops at `review` and
 * skips the rest; a low-risk result skips `review` and `execute` (nothing to approve).
 */
import type { AgentRunDto, ApprovalDto, RiskLevel, RunStatus } from '@/lib/types'

export type StageId = 'intake' | 'analyze' | 'review' | 'execute' | 'done'
export type StageState = 'done' | 'active' | 'waiting' | 'upcoming' | 'failed' | 'stopped' | 'skipped'

export interface Stage {
  id: StageId
  label: string
  /** One short line under the label: what happened or what is pending. */
  detail: string
  state: StageState
}

export const STAGE_IDS: readonly StageId[] = ['intake', 'analyze', 'review', 'execute', 'done']

export const STAGE_LABEL: Record<StageId, string> = {
  intake: 'Intake',
  analyze: 'Analyze',
  review: 'Human review',
  execute: 'Execute',
  done: 'Recorded',
}

type RunLike = Pick<AgentRunDto, 'status' | 'output' | 'approval' | 'error'>

/** Where the run sits right now: the stage a reader should look at. */
export function currentStage(run: RunLike): StageId {
  const stages = pipelineOf(run)
  const live = stages.find((s) => s.state === 'active' || s.state === 'waiting' || s.state === 'failed' || s.state === 'stopped')
  return live?.id ?? 'done'
}

export function pipelineOf(run: RunLike): Stage[] {
  const { status, output, approval, error } = run
  const approvedAlready = approval?.status === 'APPROVED'
  const noApproval = !!output && !output.requiresApproval

  const s = (id: StageId, state: StageState, detail: string): Stage => ({ id, label: STAGE_LABEL[id], state, detail })

  const risk = output ? riskWord(output.riskLevel) : ''

  switch (status as RunStatus) {
    case 'PENDING':
      return [
        s('intake', 'active', 'Queued'),
        s('analyze', 'upcoming', 'Model call'),
        s('review', 'upcoming', 'Approval'),
        s('execute', 'upcoming', 'Once'),
        s('done', 'upcoming', 'Audit log'),
      ]
    case 'RUNNING':
      if (approvedAlready) {
        return [
          s('intake', 'done', 'Received'),
          s('analyze', 'done', risk),
          s('review', 'done', 'Approved'),
          s('execute', 'active', 'Running'),
          s('done', 'upcoming', 'Audit log'),
        ]
      }
      return [
        s('intake', 'done', 'Received'),
        s('analyze', 'active', 'Reading invoice'),
        s('review', 'upcoming', 'Approval'),
        s('execute', 'upcoming', 'Once'),
        s('done', 'upcoming', 'Audit log'),
      ]
    case 'AWAITING_APPROVAL':
      return [
        s('intake', 'done', 'Received'),
        s('analyze', 'done', risk),
        s('review', 'waiting', approval ? `Waiting on ${approval.reviewerUsername}` : 'Waiting'),
        s('execute', 'upcoming', 'Once'),
        s('done', 'upcoming', 'Audit log'),
      ]
    case 'APPROVED':
      return [
        s('intake', 'done', 'Received'),
        s('analyze', 'done', risk),
        s('review', 'done', approval ? `Approved by ${approval.reviewerUsername}` : 'Approved'),
        s('execute', 'active', 'Starting'),
        s('done', 'upcoming', 'Audit log'),
      ]
    case 'COMPLETED':
      if (noApproval) {
        return [
          s('intake', 'done', 'Received'),
          s('analyze', 'done', risk),
          s('review', 'skipped', 'Not needed'),
          s('execute', 'skipped', 'No action'),
          s('done', 'done', 'Closed'),
        ]
      }
      return [
        s('intake', 'done', 'Received'),
        s('analyze', 'done', risk),
        s('review', 'done', approval ? `Approved by ${approval.reviewerUsername}` : 'Approved'),
        s('execute', 'done', 'Ran once'),
        s('done', 'done', 'Closed'),
      ]
    case 'REJECTED':
    case 'CANCELLED':
      return [
        s('intake', 'done', 'Received'),
        s('analyze', output ? 'done' : 'skipped', output ? risk : 'Not run'),
        s('review', approval?.status === 'REJECTED' ? 'stopped' : 'skipped', approval?.status === 'REJECTED' ? `Rejected by ${approval.reviewerUsername}` : 'Cancelled'),
        s('execute', 'skipped', 'Nothing ran'),
        s('done', status === 'CANCELLED' ? 'done' : 'upcoming', status === 'CANCELLED' ? 'Cancelled' : 'Closing'),
      ]
    case 'FAILED':
      return [
        s('intake', 'done', 'Received'),
        s('analyze', 'failed', error ? 'Model error' : 'Failed'),
        s('review', 'skipped', 'Not requested'),
        s('execute', 'skipped', 'Nothing ran'),
        s('done', 'done', 'Logged'),
      ]
    default:
      return STAGE_IDS.map((id) => s(id, 'upcoming', ''))
  }
}

function riskWord(level: RiskLevel): string {
  return level === 'high' ? 'High risk' : level === 'medium' ? 'Medium risk' : 'Low risk'
}

/** Fraction of the pipeline travelled, 0..1 — used to place the carriage on the machine. */
export function progressOf(run: RunLike): number {
  const idx = STAGE_IDS.indexOf(currentStage(run))
  return idx / (STAGE_IDS.length - 1)
}

/** Board columns for the overview: where each run currently sits. */
export type BoardColumn = 'queued' | 'analyzing' | 'review' | 'executing' | 'completed' | 'stopped'

export function boardColumnOf(status: RunStatus): BoardColumn {
  switch (status) {
    case 'PENDING':
      return 'queued'
    case 'RUNNING':
      return 'analyzing'
    case 'AWAITING_APPROVAL':
      return 'review'
    case 'APPROVED':
      return 'executing'
    case 'COMPLETED':
      return 'completed'
    default:
      return 'stopped'
  }
}

/** The pipeline as a reviewer sees it: an approval carries enough to place its run on the line. */
export function runOfApproval(a: ApprovalDto): RunLike & { id: number } {
  return {
    id: a.agentRunId,
    status: a.status === 'PENDING' ? 'AWAITING_APPROVAL' : a.status === 'APPROVED' ? 'COMPLETED' : 'CANCELLED',
    output: { riskLevel: a.riskLevel, recommendedAction: a.proposedAction, requiresApproval: true, reasoningSummary: a.reasoningSummary },
    approval: a,
    error: null,
  }
}
