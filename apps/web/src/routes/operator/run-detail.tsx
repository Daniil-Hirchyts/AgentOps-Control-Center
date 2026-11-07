import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SystemMessage } from '@/components/prompt-kit/system-message'
import { ThinkingBar } from '@/components/prompt-kit/thinking-bar'
import { Steps, StepsContent, StepsTrigger } from '@/components/prompt-kit/steps'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceSheet } from '@/components/shared/invoice-visuals'
import { BackLink, MetaDot, PageHeader, Section } from '@/components/shared/page-header'
import { ErrorState, ListSkeleton } from '@/components/shared/states'
import { ApprovalStatusBadge, RunStatusBadge } from '@/components/shared/status'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentCalls, Evidence, ReasoningChain } from '@/features/agents/analysis'
import { isRunActive, useRun } from '@/features/agents/hooks'
import { PipelineFigure } from '@/features/agents/pipeline-figure'
import { AuditEventList } from '@/features/audit/audit-event-list'
import { useAuditEvents } from '@/features/audit/hooks'
import { useUsers } from '@/features/messaging/hooks'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { actionLabel } from '@/lib/labels'
import type { AgentRunDto } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

export function RunDetailPage({ runId }: { runId: number }) {
  const run = useRun(runId)
  const audit = useAuditEvents({ agentRunId: runId })
  const users = useUsers()
  useDocumentTitle(`Run #${runId}`)
  const back = <BackLink to="/operator/runs">Runs</BackLink>

  if (run.isPending) return <RunDetailSkeleton />
  if (run.isError) {
    return (
      <PageContainer>
        {back}
        <ErrorState
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
  const events = audit.data?.items ?? []

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        back={back}
        title={<span className="tabular-nums">Run #{r.id}</span>}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RunStatusBadge status={r.status} />
            <MetaDot />
            <Link to="/operator/cases/$caseId" params={{ caseId: String(r.caseId) }} className="text-text underline-offset-2 hover:underline">
              {r.caseTitle}
            </Link>
            <MetaDot />
            <span className="tabular-nums">Started {formatDateTime(r.createdAt)}</span>
          </span>
        }
        actions={
          <Button asChild data-testid="discuss-with-reviewer">
            <Link to="/messages/$userId" params={{ userId: String(r.reviewerId) }}>
              Message {reviewerName}
            </Link>
          </Button>
        }
      />

      <PipelineFigure run={r} className="mb-10" />

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="min-w-0 space-y-12">
          <Section title="Analysis" data-testid="analysis-card">
            <Analysis run={r} />
          </Section>

          <Section title="Agent calls" aside={<span className="text-text-tertiary">Each step the agent took</span>}>
            <AgentCalls run={r} />
          </Section>

          <Section title="Invoice">
            <InvoiceSheet invoice={r.inputSnapshot} className="max-w-xl" />
          </Section>
        </div>

        <aside className="min-w-0 space-y-12">
          <Section
            title="Approval"
            aside={r.approval ? <ApprovalStatusBadge status={r.approval.status} /> : null}
            data-testid="approval-card"
          >
            <ApprovalSummary run={r} reviewerName={reviewerName} />
          </Section>

          <Section
            title="Activity"
            aside={
              <Link to="/operator/audit" search={{ agentRunId: r.id }} className="text-text-secondary hover:text-text">
                Audit log
              </Link>
            }
          >
            {audit.isPending ? (
              <ListSkeleton rows={4} />
            ) : audit.isError ? (
              <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
            ) : events.length === 0 ? (
              <p className="text-13 text-text-tertiary">No events yet.</p>
            ) : (
              <Steps defaultOpen>
                <StepsTrigger>
                  <span className="tabular-nums">
                    {events.length} {events.length === 1 ? 'event' : 'events'}
                  </span>
                </StepsTrigger>
                <StepsContent>
                  <AuditEventList events={events} />
                </StepsContent>
              </Steps>
            )}
          </Section>
        </aside>
      </div>
    </PageContainer>
  )
}

function Analysis({ run: r }: { run: AgentRunDto }) {
  if (r.output) {
    return (
      <div className="space-y-8">
        <Evidence invoice={r.inputSnapshot} risk={r.output.riskLevel} />
        <ReasoningChain invoice={r.inputSnapshot} action={r.output.recommendedAction} summary={r.output.reasoningSummary} />
      </div>
    )
  }
  if (r.error) {
    return (
      <SystemMessage variant="error" role="alert">
        <p className="font-medium">Analysis failed</p>
        <p className="mt-0.5">{r.error}</p>
        <p className="mt-1 opacity-80">Nothing was executed. A failed analysis is never auto-approved.</p>
      </SystemMessage>
    )
  }
  return (
    <ThinkingBar
      text={r.status === 'PENDING' ? 'Queued for analysis' : 'Analyzing invoice'}
      detail={r.status === 'PENDING' ? undefined : `Calling ${r.modelIdentifier}`}
      className="py-2"
    />
  )
}

function ApprovalSummary({ run: r, reviewerName }: { run: AgentRunDto; reviewerName: string }) {
  const a = r.approval
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
        <Row label="Reviewer">{reviewerName}</Row>
        {a && (
          <>
            <Row label="Proposed">{actionLabel(a.proposedAction)}</Row>
            <Row label="Requested">
              <span className="tabular-nums">{formatDateTime(a.createdAt)}</span>
            </Row>
            {a.status !== 'PENDING' && (
              <>
                <Row label="Decided">
                  <span className="tabular-nums">{formatDateTime(a.decidedAt)}</span>
                </Row>
                <Row label="Reason">
                  {a.decisionReason ? (
                    <span className="whitespace-pre-wrap">“{a.decisionReason}”</span>
                  ) : (
                    <span className="text-text-tertiary">None given</span>
                  )}
                </Row>
              </>
            )}
          </>
        )}
      </dl>
      {!a && (
        <SystemMessage>
          {r.output && !r.output.requiresApproval
            ? 'No approval needed. The agent recommended no action.'
            : isRunActive(r.status)
              ? 'An approval is requested once the analysis finishes.'
              : 'No approval was requested.'}
        </SystemMessage>
      )}
      {a?.status === 'PENDING' && (
        <SystemMessage variant="warning">The gate stays closed until {reviewerName} decides. Nothing runs before that.</SystemMessage>
      )}
      {a?.status === 'REJECTED' && <SystemMessage variant="error">Rejected. The action did not run and the run was cancelled.</SystemMessage>}
      {a?.status === 'APPROVED' && r.status === 'COMPLETED' && (
        <SystemMessage variant="success">Approved. The action ran once and is recorded in the audit log.</SystemMessage>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </>
  )
}

function RunDetailSkeleton() {
  return (
    <PageContainer className="max-w-6xl">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <Skeleton className="mb-10 aspect-[2.2/1] w-full rounded-xl" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
