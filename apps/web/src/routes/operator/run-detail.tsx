import { Link } from '@tanstack/react-router'
import { ArrowLeft, Bot, Cpu, MessageSquare, ScrollText, UserCheck } from 'lucide-react'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceDetails } from '@/components/shared/invoice-details'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState, ListSkeleton } from '@/components/shared/states'
import { ApprovalStatusBadge, RiskBadge, RunStatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRun } from '@/features/agents/hooks'
import { AuditEventList } from '@/features/audit/audit-event-list'
import { useAuditEvents } from '@/features/audit/hooks'
import { useUsers } from '@/features/messaging/hooks'
import { ApiError } from '@/lib/api'
import type { AgentRunDto, AuditEventDto, RunStatus } from '@/lib/types'
import { RUN_STATUSES } from '@/lib/types'
import { formatDateTime, humanize } from '@/lib/utils'

interface Step {
  status: RunStatus
  at: string
}

function isRunStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && (RUN_STATUSES as readonly string[]).includes(v)
}

/** Status history derived from `run_status_changed` audit events (falls back to current status). */
export function deriveTimeline(run: AgentRunDto, events: AuditEventDto[]): Step[] {
  const steps: Step[] = [{ status: 'PENDING', at: run.createdAt }]
  for (const e of events) {
    if (e.eventType !== 'run_status_changed') continue
    const to = e.payload.to ?? e.payload.toStatus ?? e.payload.status
    if (isRunStatus(to) && steps[steps.length - 1]?.status !== to) steps.push({ status: to, at: e.createdAt })
  }
  if (steps[steps.length - 1]?.status !== run.status) steps.push({ status: run.status, at: run.updatedAt })
  return steps
}

export function RunDetailPage({ runId }: { runId: number }) {
  const run = useRun(runId)
  const audit = useAuditEvents({ agentRunId: runId })
  const users = useUsers()

  const back = (
    <Link to="/operator/runs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" /> Runs
    </Link>
  )

  if (run.isPending) {
    return (
      <PageContainer>
        <Skeleton className="mb-6 h-8 w-72" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </PageContainer>
    )
  }
  if (run.isError) {
    return (
      <PageContainer>
        {back}
        <ErrorState
          className="mt-4"
          error={run.error}
          title={run.error instanceof ApiError && run.error.isNotFound ? 'Run not found' : 'Could not load run'}
          onRetry={() => void run.refetch()}
        />
      </PageContainer>
    )
  }

  const r = run.data
  const reviewer = users.data?.find((u) => u.id === r.reviewerId)
  const reviewerName = r.approval?.reviewerUsername ?? reviewer?.username ?? `user #${r.reviewerId}`
  const timeline = deriveTimeline(r, audit.data?.items ?? [])

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Run #{r.id}
            <RunStatusBadge status={r.status} className="text-sm" />
          </span>
        }
        description={
          <span>
            Case{' '}
            <Link
              to="/operator/cases/$caseId"
              params={{ caseId: String(r.caseId) }}
              className="font-medium text-primary hover:underline"
            >
              {r.caseTitle}
            </Link>{' '}
            · started {formatDateTime(r.createdAt)}
          </span>
        }
        actions={
          <Button variant="outline" asChild data-testid="discuss-with-reviewer">
            <Link to="/messages/$userId" params={{ userId: String(r.reviewerId) }}>
              <MessageSquare /> Discuss with {reviewerName}
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 py-4">
        <CardContent>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Status timeline" data-testid="run-timeline">
            {timeline.map((s, i) => (
              <li key={`${s.status}-${i}`} className="flex items-center gap-2">
                <div className="flex flex-col items-start gap-1">
                  <RunStatusBadgeLite status={s.status} current={i === timeline.length - 1} />
                  <span className="pl-1 text-[10px] text-muted-foreground">{formatDateTime(s.at)}</span>
                </div>
                {i < timeline.length - 1 && <span className="mb-4 h-px w-6 bg-border sm:w-10" aria-hidden />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card data-testid="analysis-card">
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" /> AI analysis
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-1.5">
                  <Cpu className="size-3" />
                  <span className="font-mono">{r.modelIdentifier}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    {r.llmMode}
                  </span>
                  · {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
                </CardDescription>
              </div>
              {r.output && <RiskBadge level={r.output.riskLevel} />}
            </CardHeader>
            <CardContent>
              {r.output ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Reasoning</p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap" data-testid="analysis-reasoning">
                      {r.output.reasoningSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Recommended action</p>
                      <p className="mt-1 font-mono text-sm">{r.output.recommendedAction}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Requires approval</p>
                      <p className="mt-1 text-sm">{r.output.requiresApproval ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              ) : r.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
                  <p className="font-medium text-destructive">Analysis failed</p>
                  <p className="mt-1 text-muted-foreground">{r.error}</p>
                  <p className="mt-2 text-xs text-muted-foreground">No action was executed (fail-safe).</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                  <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  The agent is analysing the invoice…
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceDetails invoice={r.inputSnapshot} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card data-testid="approval-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="size-4 text-primary" /> Human approval
              </CardTitle>
              {r.approval && <ApprovalStatusBadge status={r.approval.status} />}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Reviewer" value={reviewerName} />
              {r.approval ? (
                <>
                  <Row label="Proposed action" value={<span className="font-mono">{r.approval.proposedAction}</span>} />
                  <Row label="Requested" value={formatDateTime(r.approval.createdAt)} />
                  {r.approval.status !== 'PENDING' && (
                    <>
                      <Row
                        label="Decided by"
                        value={r.approval.decidedBy === r.approval.reviewerId ? r.approval.reviewerUsername : `user #${r.approval.decidedBy}`}
                      />
                      <Row label="Decided" value={formatDateTime(r.approval.decidedAt)} />
                      <Row
                        label="Reason"
                        value={r.approval.decisionReason || <span className="text-muted-foreground">No reason given</span>}
                      />
                    </>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  {r.output && !r.output.requiresApproval
                    ? 'No approval needed — the agent recommended no action.'
                    : 'No approval requested yet.'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="size-4 text-primary" /> Audit trail
              </CardTitle>
              <Link
                to="/operator/audit"
                search={{ agentRunId: r.id }}
                className="text-xs text-primary hover:underline"
              >
                Open in audit log
              </Link>
            </CardHeader>
            <CardContent>
              {audit.isPending ? (
                <ListSkeleton rows={4} />
              ) : audit.isError ? (
                <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
              ) : audit.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <AuditEventList events={audit.data.items} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}

function RunStatusBadgeLite({ status, current }: { status: RunStatus; current: boolean }) {
  return (
    <span className={current ? '' : 'opacity-70'} title={humanize(status)}>
      <RunStatusBadge status={status} className={current ? 'ring-2' : ''} testId="timeline-status" />
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
