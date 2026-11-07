/**
 * The agent's work, shown as evidence, reasoning and calls — shared by the operator's run
 * page and the reviewer's approval page.
 */
import { BookCheck, FileSearch, Scale } from 'lucide-react'
import { AgentAvatar } from '@/components/shared/agent-avatar'
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from '@/components/prompt-kit/chain-of-thought'
import { Tool, type ToolPart } from '@/components/prompt-kit/tool'
import { DeviationBar, HIGH_RATIO, RiskGauge } from '@/components/shared/invoice-visuals'
import { actionLabel, LLM_MODE_LABEL } from '@/lib/labels'
import type { ActionName, AgentRunDto, InvoiceInput, RiskLevel } from '@/lib/types'
import { deviation, formatDate, formatMoney } from '@/lib/utils'
import { AGENTS } from './agents'

/** Gauge + comparison bar: the two things the risk decision rests on. */
export function Evidence({ invoice, risk }: { invoice: InvoiceInput; risk: RiskLevel }) {
  return (
    <div className="grid items-center gap-x-8 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)]">
      <RiskGauge level={risk} />
      <DeviationBar invoice={invoice} risk={risk} />
    </div>
  )
}

/** The reasoning as three steps on one rail: read, compare, decide. */
export function ReasoningChain({
  invoice,
  action,
  summary,
  defaultOpenLast = true,
}: {
  invoice: InvoiceInput
  action: ActionName
  summary: string
  defaultOpenLast?: boolean
}) {
  const ratio = deviation(invoice)
  const avg = invoice.historicalAverage
  return (
    <ChainOfThought>
      <ChainOfThoughtStep>
        <ChainOfThoughtTrigger leftIcon={<FileSearch strokeWidth={1.75} />}>Read the invoice</ChainOfThoughtTrigger>
        <ChainOfThoughtContent>
          <ChainOfThoughtItem>
            {invoice.vendor}, {formatMoney(invoice.amount, invoice.currency)}, issued {formatDate(invoice.issueDate)}.
          </ChainOfThoughtItem>
          {invoice.description && <ChainOfThoughtItem className="text-text-tertiary">“{invoice.description}”</ChainOfThoughtItem>}
        </ChainOfThoughtContent>
      </ChainOfThoughtStep>
      <ChainOfThoughtStep>
        <ChainOfThoughtTrigger leftIcon={<Scale strokeWidth={1.75} />}>Compared with the vendor’s typical amount</ChainOfThoughtTrigger>
        <ChainOfThoughtContent>
          <ChainOfThoughtItem>
            {avg != null && ratio !== null
              ? `${ratio.toFixed(1)}× the typical ${formatMoney(avg, invoice.currency)}. Above ${HIGH_RATIO}× counts as high risk.`
              : 'No typical amount on file, so only the amount itself was judged.'}
          </ChainOfThoughtItem>
        </ChainOfThoughtContent>
      </ChainOfThoughtStep>
      <ChainOfThoughtStep defaultOpen={defaultOpenLast}>
        <ChainOfThoughtTrigger leftIcon={<BookCheck strokeWidth={1.75} />}>Recommended: {actionLabel(action).toLowerCase()}</ChainOfThoughtTrigger>
        <ChainOfThoughtContent>
          <ChainOfThoughtItem className="text-text" data-testid="analysis-reasoning">
            {summary}
          </ChainOfThoughtItem>
        </ChainOfThoughtContent>
      </ChainOfThoughtStep>
    </ChainOfThought>
  )
}

/** Each step the agent took, as a tool call with input, output and state. */
export function AgentCalls({ run }: { run: AgentRunDto }) {
  const { output, approval } = run
  const inv = run.inputSnapshot
  const calls: (ToolPart & { key: string })[] = []

  calls.push({
    key: 'model',
    title: 'Analyze invoice',
    name: run.modelIdentifier,
    avatar: <AgentAvatar agent={AGENTS.analyst} size="md" />,
    meta: `${AGENTS.analyst.name} · ${LLM_MODE_LABEL[run.llmMode]} · ${run.attempts} ${run.attempts === 1 ? 'attempt' : 'attempts'}`,
    state: output ? 'output-available' : run.error ? 'output-error' : run.status === 'PENDING' ? 'input-available' : 'input-streaming',
    stateLabel: run.status === 'PENDING' ? 'Queued' : undefined,
    input: {
      vendor: inv.vendor,
      amount: `${inv.amount} ${inv.currency}`,
      historicalAverage: inv.historicalAverage ?? null,
    },
    output: output
      ? { riskLevel: output.riskLevel, recommendedAction: output.recommendedAction, requiresApproval: output.requiresApproval }
      : undefined,
    errorText: run.error ?? undefined,
  })

  if (output?.requiresApproval || approval) {
    calls.push({
      key: 'approval',
      title: 'Request human approval',
      name: 'request_approval',
      avatar: <AgentAvatar agent={AGENTS.gatekeeper} size="md" />,
      meta: approval ? `${AGENTS.gatekeeper.name} · reviewer ${approval.reviewerUsername}` : AGENTS.gatekeeper.name,
      state: !approval
        ? 'input-streaming'
        : approval.status === 'PENDING'
          ? 'input-available'
          : approval.status === 'APPROVED'
            ? 'output-available'
            : 'output-error',
      stateLabel: approval ? { PENDING: 'Waiting', APPROVED: 'Approved', REJECTED: 'Rejected' }[approval.status] : undefined,
      input: approval ? { proposedAction: approval.proposedAction, riskLevel: approval.riskLevel } : undefined,
      output:
        approval && approval.status !== 'PENDING'
          ? { decision: approval.status, reason: approval.decisionReason ?? null }
          : undefined,
    })
  }

  if (output?.requiresApproval) {
    const ran = run.status === 'COMPLETED'
    const skipped = approval?.status === 'REJECTED' || run.status === 'CANCELLED' || run.status === 'REJECTED'
    calls.push({
      key: 'action',
      title: actionLabel(output.recommendedAction),
      name: output.recommendedAction,
      avatar: <AgentAvatar agent={AGENTS.executor} size="md" />,
      meta: `${AGENTS.executor.name} · at most once, after approval`,
      state: ran ? 'output-available' : skipped ? 'skipped' : run.status === 'RUNNING' || run.status === 'APPROVED' ? 'input-streaming' : 'input-available',
      stateLabel: ran ? 'Ran once' : skipped ? 'Not run' : run.status === 'AWAITING_APPROVAL' ? 'Blocked' : undefined,
      input: { caseId: run.caseId },
      output: ran ? { caseStatus: 'FLAGGED_FOR_REVIEW' } : undefined,
    })
  }

  return (
    <div className="space-y-2" data-testid="agent-calls">
      {calls.map(({ key, ...part }) => (
        <Tool key={key} toolPart={part} testId={`tool-${key}`} />
      ))}
    </div>
  )
}

