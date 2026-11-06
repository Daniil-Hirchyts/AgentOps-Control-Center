import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { CircularLoader } from '@/components/prompt-kit/loader'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/prompt-kit/reasoning'
import { Steps, StepsContent, StepsTrigger } from '@/components/prompt-kit/steps'
import { TextShimmer } from '@/components/prompt-kit/text-shimmer'
import { PageContainer } from '@/components/layout/app-shell'
import { InvoiceDetails } from '@/components/shared/invoice-details'
import { BackLink, MetaDot, PageHeader, Section } from '@/components/shared/page-header'
import { ErrorState, ListSkeleton } from '@/components/shared/states'
import { ApprovalStatusBadge, RiskBadge, RunStatusBadge } from '@/components/shared/status'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isRunActive, useRun } from '@/features/agents/hooks'
import { AuditEventList } from '@/features/audit/audit-event-list'
import { useAuditEvents } from '@/features/audit/hooks'
import { useUsers } from '@/features/messaging/hooks'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { actionLabel, LLM_MODE_LABEL } from '@/lib/labels'
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
    <PageContainer>
      <PageHeader
        back={back}
        title={<span className="tabular-nums">Run #{r.id}</span>}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RunStatusBadge status={r.status} />
            <MetaDot />
            <Link
              to="/operator/cases/$caseId"
              params={{ caseId: String(r.caseId) }}
              className="text-text hover:underline"
            >
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

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-10">
          <Section
            title="Analysis"
            aside={
              <span className="truncate font-mono text-xs text-text-tertiary" title={`${r.modelIdentifier} · ${LLM_MODE_LABEL[r.llmMode]}`}>
                {r.modelIdentifier} · {r.llmMode} · {r.attempts} {r.attempts === 1 ? 'attempt' : 'attempts'}
              </span>
            }
            data-testid="analysis-card"
          >
            <Analysis run={r} />
          </Section>

          <Section title="Invoice">
            <InvoiceDetails invoice={r.inputSnapshot} />
          </Section>
        </div>

        <div className="min-w-0 space-y-10">
          <Section
            title="Approval"
            aside={r.approval ? <ApprovalStatusBadge status={r.approval.status} /> : null}
            data-testid="approval-card"
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <Row label="Reviewer">{reviewerName}</Row>
              {r.approval ? (
                <>
                  <Row label="Proposed action">{actionLabel(r.approval.proposedAction)}</Row>
                  <Row label="Requested">
                    <span className="tabular-nums">{formatDateTime(r.approval.createdAt)}</span>
                  </Row>
                  {r.approval.status !== 'PENDING' && (
                    <>
                      <Row label="Decided by">
                        {r.approval.decidedBy === r.approval.reviewerId
                          ? r.approval.reviewerUsername
                          : `user #${r.approval.decidedBy}`}
                      </Row>
                      <Row label="Decided">
                        <span className="tabular-nums">{formatDateTime(r.approval.decidedAt)}</span>
                      </Row>
                      <Row label="Reason">
                        {r.approval.decisionReason ? (
                          <span className="whitespace-pre-wrap">“{r.approval.decisionReason}”</span>
                        ) : (
                          <span className="text-text-tertiary">None given</span>
                        )}
                      </Row>
                    </>
                  )}
                </>
              ) : null}
            </dl>
            {!r.approval && (
              <p className="mt-3 text-13 text-text-secondary">
                {r.output && !r.output.requiresApproval
                  ? 'No approval needed. The agent recommended no action.'
                  : isRunActive(r.status)
                    ? 'An approval is requested once the analysis finishes.'
                    : 'No approval was requested.'}
              </p>
            )}
            {r.approval?.status === 'PENDING' && (
              <p className="mt-3 text-13 text-text-secondary">Waiting for {reviewerName} to decide.</p>
            )}
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
        </div>
      </div>
    </PageContainer>
  )
}

function Analysis({ run: r }: { run: AgentRunDto }) {
  if (r.output) {
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Row label="Risk">
            <RiskBadge level={r.output.riskLevel} className="text-sm" />
          </Row>
          <Row label="Recommendation">
            <span className="font-medium">{actionLabel(r.output.recommendedAction)}</span>
          </Row>
          <Row label="Needs approval">{r.output.requiresApproval ? 'Yes' : 'No'}</Row>
        </dl>
        <Reasoning defaultOpen>
          <ReasoningTrigger>Reasoning</ReasoningTrigger>
          <ReasoningContent>
            <p
              className="max-w-prose border-l-2 border-border pl-3 leading-relaxed whitespace-pre-wrap"
              data-testid="analysis-reasoning"
            >
              {r.output.reasoningSummary}
            </p>
          </ReasoningContent>
        </Reasoning>
      </div>
    )
  }
  if (r.error) {
    return (
      <div role="alert" className="space-y-1">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-2 rounded-full bg-danger-dot" />
          Analysis failed
        </p>
        <p className="text-13 text-text-secondary">{r.error}</p>
        <p className="text-13 text-text-tertiary">Nothing was executed. Failed analyses are never auto-approved.</p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 py-2" role="status" aria-live="polite">
      <CircularLoader size="sm" />
      <TextShimmer className="text-sm">Analyzing invoice…</TextShimmer>
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
    <PageContainer>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-3">
          <Skeleton className="mb-5 h-3 w-20" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="mb-5 h-3 w-20" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
