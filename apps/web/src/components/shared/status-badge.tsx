import {
  CheckCircle2,
  CircleDashed,
  Hourglass,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from 'lucide-react'
import { cn, humanize } from '@/lib/utils'
import type { ApprovalStatus, CaseStatus, RiskLevel, RunStatus } from '@/lib/types'
import { type Meta, RUN_STATUS_META, type Tone } from './status-meta'


const toneClass: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  info: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
  progress: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900',
  muted: 'bg-zinc-50 text-zinc-500 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800',
}


const APPROVAL_STATUS_META: Record<ApprovalStatus, Meta> = {
  PENDING: { tone: 'warning', icon: Hourglass },
  APPROVED: { tone: 'success', icon: CheckCircle2 },
  REJECTED: { tone: 'danger', icon: XCircle },
}

const CASE_STATUS_META: Record<CaseStatus, Meta> = {
  OPEN: { tone: 'info', icon: CircleDashed },
  FLAGGED_FOR_REVIEW: { tone: 'warning', icon: ShieldAlert, label: 'Flagged for review' },
  CLOSED: { tone: 'muted', icon: CheckCircle2 },
}

const RISK_META: Record<RiskLevel, Meta> = {
  low: { tone: 'success', icon: ShieldCheck, label: 'Low risk' },
  medium: { tone: 'warning', icon: ShieldQuestion, label: 'Medium risk' },
  high: { tone: 'danger', icon: ShieldAlert, label: 'High risk' },
}

function Pill({ meta, value, className, testId }: { meta: Meta; value: string; className?: string; testId?: string }) {
  const Icon = meta.icon
  return (
    <span
      data-testid={testId}
      data-status={value}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        toneClass[meta.tone],
        className,
      )}
    >
      <Icon className={cn('size-3', meta.spin && 'animate-spin')} aria-hidden />
      {meta.label ?? humanize(value)}
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
  return <Pill meta={RUN_STATUS_META[status]} value={status} className={className} testId={testId} />
}

export function ApprovalStatusBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  return <Pill meta={APPROVAL_STATUS_META[status]} value={status} className={className} testId="approval-status" />
}

export function CaseStatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  return <Pill meta={CASE_STATUS_META[status]} value={status} className={className} testId="case-status" />
}

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return <Pill meta={RISK_META[level]} value={level} className={className} testId="risk-badge" />
}

