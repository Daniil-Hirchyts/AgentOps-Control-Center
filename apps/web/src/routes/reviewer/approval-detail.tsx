import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Bot, Check, Info, Loader2, MessageSquare, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceDetails } from '@/components/shared/invoice-details'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/states'
import { ApprovalStatusBadge, RiskBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { qk } from '@/lib/query-keys'
import type { ActionName, DecisionRequest } from '@/lib/types'
import { formatDateTime, formatRelative } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'

const MAX_REASON = 1000

const ACTION_EXPLANATION: Record<ActionName, string> = {
  flag_invoice_for_review:
    'If approved, the case is marked FLAGGED_FOR_REVIEW in the synthetic case database (no external system is touched). If rejected, nothing is executed and the run is cancelled.',
  no_action: 'The agent found nothing to act on. Approving simply confirms that no action is taken.',
}

type Decision = DecisionRequest['decision']

export function ApprovalDetailPage({ approvalId }: { approvalId: number }) {
  const me = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const approval = useApproval(approvalId)
  const decide = useDecision(approvalId)
  const markSeen = useRealtimeStore((s) => s.markApprovalSeen)
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    markSeen(approvalId)
  }, [approvalId, markSeen])

  const back = (
    <Link to="/reviewer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" /> Inbox
    </Link>
  )

  if (approval.isPending) {
    return (
      <PageContainer className="max-w-4xl">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-80 w-full" />
      </PageContainer>
    )
  }
  if (approval.isError) {
    return (
      <PageContainer className="max-w-4xl">
        {back}
        <ErrorState
          className="mt-4"
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
        toast.info('Already decided', { description: 'This approval was already decided. Showing the latest state.' })
        void qc.invalidateQueries({ queryKey: qk.approval(approvalId) })
        void qc.invalidateQueries({ queryKey: qk.approvals })
      } else {
        toast.error('Decision failed', { description: errorMessage(err) })
      }
    }
  }

  return (
    <PageContainer className="max-w-4xl pb-28 md:pb-6">
      <PageHeader
        back={back}
        title={a.caseTitle}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ApprovalStatusBadge status={a.status} />
            <RiskBadge level={a.riskLevel} />
            <span>
              Requested by <strong className="text-foreground">{a.requestedByUsername}</strong>{' '}
              {formatRelative(a.createdAt)}
            </span>
          </span>
        }
        actions={
          <Button variant="outline" asChild data-testid="message-operator">
            <Link to="/messages/$userId" params={{ userId: String(a.requestedBy) }}>
              <MessageSquare /> Message {a.requestedByUsername}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" /> AI reasoning
                </CardTitle>
                <CardDescription className="mt-1">Why the agent proposes this action</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="approval-reasoning">
                {a.reasoningSummary}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4 text-primary" /> Proposed action
              </CardTitle>
              <code className="rounded bg-card px-2 py-0.5 font-mono text-xs ring-1 ring-border">{a.proposedAction}</code>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{ACTION_EXPLANATION[a.proposedAction]}</p>
            </CardContent>
          </Card>

          {decided && (
            <Card data-testid="decision-summary">
              <CardHeader>
                <CardTitle>Decision</CardTitle>
                <ApprovalStatusBadge status={a.status} />
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  {a.status === 'APPROVED' ? 'Approved' : 'Rejected'}{' '}
                  {a.decidedBy === a.reviewerId ? `by ${a.reviewerUsername}` : ''} on {formatDateTime(a.decidedAt)}
                </p>
                <p className="text-muted-foreground">{a.decisionReason || 'No reason given.'}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceDetails invoice={a.invoice} />
          </CardContent>
        </Card>
      </div>

      {/* Sticky action bar on mobile, inline on desktop */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t bg-card/95 p-3 backdrop-blur md:static md:mt-6 md:rounded-xl md:border md:p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center">
          <p className="flex-1 text-xs text-muted-foreground">
            {decided
              ? 'This approval has been decided and can no longer be changed.'
              : !isAssignee
                ? `Only ${a.reviewerUsername} can decide on this approval.`
                : 'Your decision is recorded in the audit log.'}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="destructive"
              size="lg"
              disabled={!canDecide}
              onClick={() => setPendingDecision('reject')}
              data-testid="reject-button"
            >
              <X /> Reject
            </Button>
            <Button
              variant="success"
              size="lg"
              disabled={!canDecide}
              onClick={() => setPendingDecision('approve')}
              data-testid="approve-button"
            >
              <Check /> Approve
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
                ? `The agent will execute “${a.proposedAction}” exactly once.`
                : 'Nothing will be executed and the run will be cancelled.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decision-reason">Reason (optional)</Label>
            <Textarea
              id="decision-reason"
              rows={3}
              value={reason}
              maxLength={MAX_REASON}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add context for the operator and the audit log"
              data-testid="decision-reason"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {reason.length}/{MAX_REASON}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDecision(null)} disabled={decide.isPending}>
              Cancel
            </Button>
            <Button
              variant={pendingDecision === 'approve' ? 'success' : 'destructive'}
              onClick={() => void confirm()}
              disabled={decide.isPending}
              data-testid="confirm-decision"
            >
              {decide.isPending && <Loader2 className="animate-spin" />}
              {pendingDecision === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
