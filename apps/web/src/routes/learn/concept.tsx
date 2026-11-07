import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageContainer } from '@/components/layout/app-shell'
import { AgentAvatar } from '@/components/shared/agent-avatar'
import { DeviationMini, RiskGauge } from '@/components/shared/invoice-visuals'
import { UserAvatar } from '@/components/shared/presence'
import { Button } from '@/components/ui/button'
import { AGENTS, type AgentId } from '@/features/agents/agents'
import { predictRisk, SCENARIOS } from '@/features/cases/schema'
import { useDocumentTitle } from '@/lib/hooks'
import { cn, formatMoney } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

export function ConceptPage() {
  useDocumentTitle('Concept')
  const role = useAuthStore((s) => s.user?.role)
  return (
    <PageContainer className="max-w-5xl">
      <header className="mb-12 max-w-2xl sm:mb-16">
        <p className="mb-3 text-13 font-medium text-accent-text">Concept</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[2.5rem] sm:leading-[1.1]">
          A messenger where an AI may propose, but only a person can approve.
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          The project started as an instant messenger between two devices. AgentOps gives the two people a reason to talk: an AI
          agent checks invoices, and when it wants to act on one, a human has to say yes first.
        </p>
      </header>

      <Block title="What we simulate">
        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="rounded-3xl bg-hue-stone p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.01em]">The accounts-payable team of a fictional company.</p>
            <p className="mt-3 text-sm text-text-secondary">
              Vendors send invoices. Most are routine, but some are not: a bill five times the usual amount, the same work billed
              twice, a large first invoice from a vendor nobody knows. Checking each one by hand is slow, so an agent reads them
              first.
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              When the agent finds something odd it proposes to <strong className="font-medium text-text">flag the invoice for review</strong>.
              That changes the company’s records, so it is never done automatically: the request goes to a reviewer, who discusses
              it with the operator in the chat and approves or rejects it.
            </p>
          </div>
          <div className="flex flex-col gap-5 rounded-3xl bg-bg-subtle p-6 sm:p-8">
            <p className="text-sm font-semibold">Everything here is synthetic</p>
            <ul className="space-y-2.5 text-13 text-text-secondary">
              <li>Vendors, invoices and amounts are made up.</li>
              <li>“Flag the invoice” only changes a status in this app’s own database. No external system is touched.</li>
              <li>The model is a deterministic mock by default, or a local LM Studio model. No data leaves the machine.</li>
            </ul>
          </div>
        </div>
      </Block>

      <Block title="Who is involved">
        <div className="grid gap-4 md:grid-cols-2">
          <Cast
            title="People"
            subtitle="Real users, each on their own device"
            rows={[
              { avatar: <UserAvatar username="alice" size="lg" />, name: 'Alice · Operator', text: 'Opens a case for an invoice, starts the analysis and picks who reviews it.' },
              { avatar: <UserAvatar username="carol" size="lg" />, name: 'Carol · Operator', text: 'A second operator, so you can see two people working the same queue.' },
              { avatar: <UserAvatar username="bob" size="lg" />, name: 'Bob · Reviewer', text: 'Gets approval requests in real time, reads the evidence, then approves or rejects. Only a reviewer can.' },
              { avatar: <UserAvatar username="dave" size="lg" />, name: 'Dave · Reviewer', text: 'A second reviewer. An approval assigned to Bob cannot be decided by Dave.' },
            ]}
          />
          <Cast
            title="Agents"
            subtitle="Roles inside the server, not separate programs"
            rows={(['analyst', 'gatekeeper', 'executor', 'orchestrator', 'relay'] as AgentId[]).map((id) => ({
              avatar: <AgentAvatar agent={AGENTS[id]} size="lg" />,
              name: AGENTS[id].name,
              text: AGENTS[id].role,
            }))}
          />
        </div>
      </Block>

      <Block title="What a case is">
        <p className="mb-6 max-w-2xl text-sm text-text-secondary">
          A case is <strong className="font-medium text-text">one invoice under investigation</strong>: vendor, amount, issue date, a short
          description, and the vendor’s typical amount if we have history. The agent compares the amount with that typical amount.
          These are the four kinds of case you can create from the “New case” dialog, and what the agent will do with each.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const amount = Number(s.values.amount)
            const avg = s.values.historicalAverage ? Number(s.values.historicalAverage) : null
            const risk = predictRisk(amount, avg) ?? 'low'
            return (
              <article key={s.id} className="surface flex gap-4 rounded-2xl p-5">
                <RiskGauge level={risk} size={72} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="mt-0.5 truncate text-13 text-text-secondary">{s.values.vendor}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(amount, s.values.currency)}</span>
                    <DeviationMini invoice={{ amount, historicalAverage: avg }} />
                  </div>
                  <p className="mt-3 text-13 text-text-secondary">{OUTCOME[s.id]}</p>
                </div>
              </article>
            )
          })}
        </div>
        <Rules />
      </Block>

      <Block title="The life of a case">
        <ol className="relative space-y-3 before:absolute before:inset-y-6 before:start-[1.375rem] before:w-px before:bg-border">
          {STORY.map((step, i) => (
            <li key={i} className="relative flex gap-4">
              <span className="relative z-10 rounded-full bg-bg p-0.5">{step.who}</span>
              <div className={cn('min-w-0 flex-1 rounded-2xl p-4 sm:p-5', step.gate ? 'bg-warning-subtle' : 'bg-bg-subtle')}>
                <p className="text-sm font-semibold">
                  <span className="me-2 font-mono text-13 text-text-tertiary tabular-nums">{i + 1}</span>
                  {step.title}
                </p>
                <p className="mt-1 text-13 text-text-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      <div className="flex flex-col items-start gap-4 rounded-3xl bg-ink p-6 text-text-on-ink sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-lg font-semibold tracking-[-0.01em]">Want to see how the servers and sockets do this?</p>
          <p className="mt-1 text-sm opacity-70">The architecture page walks through every request and push.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-text-on-ink text-ink hover:opacity-90">
            <Link to="/learn/architecture">
              Architecture <ArrowRight />
            </Link>
          </Button>
          {role === 'OPERATOR' && (
            <Button asChild variant="ghost" className="text-text-on-ink hover:bg-white/10 hover:text-text-on-ink">
              <Link to="/operator/cases">Try a case</Link>
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

const OUTCOME: Record<string, string> = {
  spike: 'More than 3× the typical bill: high risk. The agent proposes to flag it, and a reviewer must approve.',
  duplicate: 'Same items billed again, three times the usual total: high risk, goes to a reviewer.',
  'new-vendor': 'No history to compare with, but over 10 000: high risk on the amount alone.',
  routine: 'Close to the usual amount: low risk. No action, so no approval is needed and the run just completes.',
}

function Rules() {
  const rules: [string, string][] = [
    ['The model recommends, the server decides', 'Whatever the model says, flagging always needs a human.'],
    ['Only two possible actions', 'Flag the invoice, or do nothing. Anything else the model invents is rejected.'],
    ['A failure is never a yes', 'Timeout, invalid answer, model down: the run fails and nothing happens.'],
    ['One approval, one action', 'An approved action runs exactly once, even after a double click or a restart.'],
  ]
  return (
    <div className="mt-8 rounded-3xl bg-bg-subtle p-6 sm:p-8">
      <p className="mb-5 text-sm font-semibold">Rules the agent cannot break</p>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {rules.map(([t, d]) => (
          <div key={t}>
            <dt className="text-sm font-medium">{t}</dt>
            <dd className="mt-0.5 text-13 text-text-secondary">{d}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-13 text-text-tertiary">
        Thresholds of the mock model: more than 3× the typical amount, or 10 000 and above, is high; 5 000 and above is medium;
        everything else is low.
      </p>
    </div>
  )
}

const STORY: { who: ReactNode; title: string; text: string; gate?: boolean }[] = [
  { who: <UserAvatar username="alice" size="lg" />, title: 'Alice opens a case', text: 'An invoice from Northwind Consulting looks expensive. She enters it, or picks the “Price spike” scenario.' },
  { who: <UserAvatar username="alice" size="lg" />, title: 'She runs the analysis and chooses Bob', text: 'The run is queued. Bob will be the only person allowed to approve whatever the agent proposes.' },
  { who: <AgentAvatar agent={AGENTS.analyst} size="lg" />, title: 'The Invoice Risk Analyst reads it', text: '€48,250 against a typical €9,800: 4.9×. High risk. It proposes to flag the invoice and explains why.' },
  { who: <AgentAvatar agent={AGENTS.gatekeeper} size="lg" />, title: 'The gate closes', text: 'Flagging changes records, so an approval is opened for Bob. Nothing runs until he decides.', gate: true },
  { who: <AgentAvatar agent={AGENTS.relay} size="lg" />, title: 'Bob’s phone lights up', text: 'The Realtime Relay pushes the request over the WebSocket. Bob sees it in his inbox without refreshing.' },
  { who: <UserAvatar username="bob" size="lg" />, title: 'They talk it over', text: 'Bob asks Alice in the chat whether there is a purchase order. Messages arrive instantly on both devices.' },
  { who: <UserAvatar username="bob" size="lg" />, title: 'Bob approves, or rejects', text: 'Approve: the action is released. Reject: the run is cancelled and nothing is executed.' },
  { who: <AgentAvatar agent={AGENTS.executor} size="lg" />, title: 'The action runs once', text: 'The case is marked “Flagged for review”. Every step above is in the audit log, with who did it and when.' },
]

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-16 sm:mb-20">
      <h2 className="mb-5 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function Cast({ title, subtitle, rows }: { title: string; subtitle: string; rows: { avatar: ReactNode; name: string; text: string }[] }) {
  return (
    <div className="surface rounded-3xl p-6">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-13 text-text-tertiary">{subtitle}</p>
      <ul className="mt-5 space-y-4">
        {rows.map((r) => (
          <li key={r.name} className="flex gap-3">
            {r.avatar}
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="mt-0.5 text-13 text-text-secondary">{r.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
