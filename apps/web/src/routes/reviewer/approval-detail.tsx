import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CircularLoader } from '@/components/prompt-kit/loader'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceDetails } from '@/components/shared/invoice-details'
import { BackLink, MetaDot, PageHeader, Section } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/states'
import { ApprovalStatusBadge, RiskBadge } from '@/components/shared/status'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApproval, useDecision } from '@/features/approvals/hooks'
import { ApiError, errorMessage } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { ACTION_EXPLANATION, actionLabel } from '@/lib/labels'
import { qk } from '@/lib/query-keys'
import type { DecisionRequest } from '@/lib/types'
import { deviation, formatDateTime, formatMoney, formatRelative } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'

const MAX_REASON = 1000

type Decision = DecisionRequest['decision']

export function ApprovalDetailPage({ approvalId }: { approvalId: number }) {
  const me = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const approval = useApproval(approvalId)
  const decide = useDecision(approvalId)
  const markSeen = useRealtimeStore((s) => s.markApprovalSeen)
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  useDocumentTitle(approval.data?.caseTitle ?? 'Approval')

  useEffect(() => {
    markSeen(approvalId)
  }, [approvalId, markSeen])

  const back = <BackLink to="/reviewer">Inbox</BackLink>

  if (approval.isPending) {
    return (
      <PageContainer className="max-w-3xl">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="mb-8 h-24 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
        </div>
      </PageContainer>
    )
  }
  if (approval.isError) {
    return (
      <PageContainer className="max-w-3xl">
        {back}
        <ErrorState
          error={approval.error}
          title={
            approval.error instanceof ApiError && approval.error.isNotFound
              ? 'Approval not found'
              : 'Could not load approval'
          }
          onRetry={() => void approval.refetch()}
        />
      </PageContainer>
    )
  }

  const a = approval.data
  const isAssignee = me?.id === a.reviewerId
  const decided = a.status !== 'PENDING'
  const canDecide = isAssignee && !decided && !decide.isPending
  const ratio = deviation(a.invoice)

  const confirm = async () => {
    if (!pendingDecision) return
    const body: DecisionRequest = { decision: pendingDecision }
    if (reason.trim()) body.reason = reason.trim()
    try {
      const updated = await decide.mutateAsync(body)
      toast.success(updated.status === 'APPROVED' ? 'Action approved' : 'Action rejected', {
        description: a.caseTitle,
      })
      setPendingDecision(null)
      setReason('')
    } catch (err) {
      setPendingDecision(null)
      if (err instanceof ApiError && err.status === 409) {
        toast.info('Already decided', { description: 'Someone decided this first. Showing the latest state.' })
        void qc.invalidateQueries({ queryKey: qk.approval(approvalId) })
        void qc.invalidateQueries({ queryKey: qk.approvals })
      } else {
        toast.error('Decision failed', { description: errorMessage(err) })
      }
    }
  }

  const note = decided
    ? 'This approval is decided and can no longer change.'
    : !isAssignee
      ? `Only ${a.reviewerUsername} can decide on this approval.`
      : 'Your decision is recorded in the audit log.'

  return (
    <PageContainer className="max-w-3xl pb-40 md:pb-8">
      <PageHeader
        back={back}
        title={a.caseTitle}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ApprovalStatusBadge status={a.status} />
            <MetaDot />
            <span>
              Requested by {a.requestedByUsername}{' '}
              <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)} className="tabular-nums">
                {formatRelative(a.createdAt)}
              </time>
            </span>
          </span>
        }
        actions={
          <Button asChild size="sm" data-testid="message-operator">
            <Link to="/messages/$userId" params={{ userId: String(a.requestedBy) }}>
              Message {a.requestedByUsername}
            </Link>
          </Button>
        }
      />

      {/* The proposal: what will happen, and the one number that matters. */}
      <section className="mb-10 rounded-lg bg-bg-subtle p-4 sm:p-5" aria-labelledby="proposal-title">
        <p className="text-13 text-text-secondary">The agent proposes</p>
        <h2 id="proposal-title" className="mt-0.5 text-base font-semibold">
          {actionLabel(a.proposedAction)}
        </h2>
        <p className="mt-1 text-13 text-text-secondary">{ACTION_EXPLANATION[a.proposedAction]}</p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-4">
          <Stat label="Amount">{formatMoney(a.invoice.amount, a.invoice.currency)}</Stat>
          {ratio !== null && <Stat label="Vs. average">{ratio.toFixed(1)}×</Stat>}
          <Stat label="Risk">
            <RiskBadge level={a.riskLevel} className="text-base font-semibold" />
          </Stat>
        </dl>
      </section>

      <div className="space-y-10">
        <Section title="Agent reasoning">
          <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap" data-testid="approval-reasoning">
            {a.reasoningSummary}
          </p>
        </Section>

        {decided && (
          <Section title="Decision" aside={<ApprovalStatusBadge status={a.status} />} data-testid="decision-summary">
            <p className="text-sm">
              {a.status === 'APPROVED' ? 'Approved' : 'Rejected'}
              {a.decidedBy === a.reviewerId ? ` by ${a.reviewerUsername}` : ''}{' '}
              <span className="text-text-secondary tabular-nums">{formatDateTime(a.decidedAt)}</span>
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {a.decisionReason ? `“${a.decisionReason}”` : 'No reason given.'}
            </p>
          </Section>
        )}

        <Section title="Invoice">
          <InvoiceDetails invoice={a.invoice} />
        </Section>
      </div>

      {/* Phones: pinned above the tab bar. Desktop: inline at the end of the page. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t bg-bg/95 px-4 pt-3 pb-3 backdrop-blur-sm md:static md:mt-10 md:border-t md:bg-transparent md:px-0 md:pt-5 md:pb-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5 md:flex-row md:items-center">
          <p className="flex-1 text-13 text-text-secondary">{note}</p>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Button
              variant="danger-soft"
              size="lg"
              className="md:h-9"
              disabled={!canDecide}
              onClick={() => setPendingDecision('reject')}
              data-testid="reject-button"
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="md:h-9"
              disabled={!canDecide}
              onClick={() => setPendingDecision('approve')}
              data-testid="approve-button"
            >
              Approve
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={pendingDecision !== null}
        onOpenChange={(o) => {
          if (!o && !decide.isPending) setPendingDecision(null)
        }}
      >
        <DialogContent data-testid="decision-dialog">
          <DialogHeader>
            <DialogTitle>{pendingDecision === 'approve' ? 'Approve this action?' : 'Reject this action?'}</DialogTitle>
            <DialogDescription>
              {pendingDecision === 'approve'
                ? `The agent will “${actionLabel(a.proposedAction).toLowerCase()}” exactly once.`
                : 'Nothing is executed and the run is cancelled.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decision-reason">
              Reason <span className="font-normal text-text-tertiary">optional</span>
            </Label>
            <Textarea
              id="decision-reason"
              rows={3}
              value={reason}
              maxLength={MAX_REASON}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Context for the operator and the audit log"
              aria-describedby="decision-reason-count"
              data-testid="decision-reason"
            />
            <p id="decision-reason-count" className="text-right text-xs text-text-tertiary tabular-nums">
              {reason.length}/{MAX_REASON}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setPendingDecision(null)} disabled={decide.isPending}>
              Cancel
            </Button>
            <Button
              variant={pendingDecision === 'approve' ? 'primary' : 'danger'}
              onClick={() => void confirm()}
              disabled={decide.isPending}
              data-testid="confirm-decision"
            >
              {decide.isPending && <CircularLoader size="sm" className="text-current" />}
              {pendingDecision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-13 text-text-secondary">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{children}</dd>
    </div>
  )
}
