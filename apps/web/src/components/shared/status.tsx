import { cn } from '@/lib/utils'
import {
  APPROVAL_STATUS,
  CASE_STATUS,
  RISK,
  RUN_STATUS,
  type StatusMeta,
  type Tone,
} from '@/lib/labels'
import type { ApprovalStatus, CaseStatus, RiskLevel, RunStatus } from '@/lib/types'

const DOT: Record<Tone, string> = {
  neutral: 'bg-neutral-solid',
  progress: 'bg-text-secondary animate-pulse-soft',
  success: 'bg-success-solid',
  warning: 'bg-warning-solid',
  danger: 'bg-danger-solid',
  muted: 'border border-neutral-solid bg-transparent',
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', DOT[tone], className)} />
}

/** Status = dot + text. Colour is never the only carrier of meaning. */
export function Status({
  meta,
  value,
  testId,
  className,
}: {
  meta: StatusMeta
  value: string
  testId?: string
  className?: string
}) {
  return (
    <span
      data-testid={testId}
      data-status={value}
      className={cn('inline-flex items-center gap-1.5 text-13 whitespace-nowrap text-text', className)}
    >
      <Dot tone={meta.tone} />
      {meta.label}
    </span>
  )
}

export function RunStatusBadge({
  status,
  className,
  testId = 'run-status',
}: {
  status: RunStatus
  className?: string
  testId?: string
}) {
  return <Status meta={RUN_STATUS[status]} value={status} className={className} testId={testId} />
}

export function ApprovalStatusBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  return <Status meta={APPROVAL_STATUS[status]} value={status} className={className} testId="approval-status" />
}

export function CaseStatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  return <Status meta={CASE_STATUS[status]} value={status} className={className} testId="case-status" />
}

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return <Status meta={RISK[level]} value={level} className={className} testId="risk-badge" />
}
