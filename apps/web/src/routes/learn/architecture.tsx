import type { ReactNode } from 'react'
import { PageContainer } from '@/components/layout/app-shell'
import { AgentAvatar } from '@/components/shared/agent-avatar'
import { AGENTS } from '@/features/agents/agents'
import { DiagramFrame, Legend, RunStateMachine, Sequence, SystemMap } from '@/features/learn/diagrams'
import { useDocumentTitle } from '@/lib/hooks'

export function ArchitecturePage() {
  useDocumentTitle('Architecture')
  return (
    <PageContainer className="max-w-5xl">
      <header className="mb-10 max-w-2xl sm:mb-14">
        <p className="mb-3 text-13 font-medium text-accent-text">Architecture</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[2.5rem] sm:leading-[1.1]">
          Two devices, one server, and a human in the loop.
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          Every message and every decision goes through one central server. It stores everything first, then pushes it to whoever is
          connected. The two devices never talk to each other directly.
        </p>
      </header>

      <Chapter n="1" title="The big picture">
        <DiagramFrame
          minWidth={820}
          caption={
            <Legend
              items={[
                { label: 'REST over HTTPS: ask, get an answer', kind: 'rest' },
                { label: 'WebSocket: the server pushes', kind: 'ws' },
                { label: 'SQL', kind: 'sql' },
                { label: 'Model call', kind: 'llm' },
              ]}
            />
          }
        >
          <SystemMap />
        </DiagramFrame>
        <Facts
          items={[
            ['One process', 'REST API, WebSocket hub and the agent worker all live in one Rust server, so they share one database pool and one view of who is online.'],
            ['Database first', 'Nothing is pushed before it is saved. If the server restarts, history, cases and approvals are still there.'],
            ['Same app, two layouts', 'The laptop and the phone run the same React app. What makes them two clients is two browsers, two logins and two sockets.'],
          ]}
        />
      </Chapter>

      <Chapter n="2" title="Which channel carries what">
        <div className="surface overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-subtle text-start text-13 text-text-secondary">
                <th className="px-4 py-3 text-start font-medium sm:px-6">What</th>
                <th className="px-4 py-3 text-start font-medium">Channel</th>
                <th className="hidden px-4 py-3 text-start font-medium sm:table-cell sm:pe-6">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {CHANNELS.map(([what, ch, why]) => (
                <tr key={what}>
                  <td className="px-4 py-3 align-top sm:px-6">
                    <span className="font-medium">{what}</span>
                    <span className="mt-0.5 block text-13 text-text-secondary sm:hidden">{why}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ChannelPill kind={ch} />
                  </td>
                  <td className="hidden px-4 py-3 align-top text-text-secondary sm:table-cell sm:pe-6">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout title="Why history is REST, not WebSocket">
          History is a resource with an address (<code className="font-mono text-13">GET /api/messages/2</code>): any client can fetch
          it after a reconnect, the request is stateless, it can be cached and paged, and it uses the same JWT check as everything
          else. The socket only carries what is new.
        </Callout>
      </Chapter>

      <Chapter n="3" title="A message from Alice to Bob">
        <DiagramFrame minWidth={760}>
          <Sequence
            actors={[
              { id: 'a', label: 'Alice’s laptop', sub: 'Device A', tone: 'blue' },
              { id: 'hub', label: 'Realtime Relay', sub: 'WebSocket hub', tone: 'ink' },
              { id: 'db', label: 'PostgreSQL', sub: 'messages table', tone: 'green' },
              { id: 'b', label: 'Bob’s phone', sub: 'Device B', tone: 'gold' },
            ]}
            steps={[
              { from: 'a', to: 'hub', label: '{ type: "message", destinataireId: 2 }', kind: 'ws' },
              { at: 'hub', note: 'Check: logged-in sender, 1–4000 chars, rate limit' },
              { from: 'hub', to: 'db', label: 'INSERT, server sets id and dateEnvoi', kind: 'sql' },
              { from: 'hub', to: 'b', label: 'push to every open socket of Bob', kind: 'ws', note: 'appears instantly, no refresh' },
              { from: 'hub', to: 'a', label: 'echo with the official id', kind: 'ws', note: 'replaces the optimistic bubble' },
              { at: 'b', note: 'Bob offline? Nothing is lost: it is already saved', tone: 'warning' },
              { from: 'b', to: 'db', label: 'on reconnect: GET /api/messages/1', kind: 'rest', note: 'full history, through the REST API' },
            ]}
          />
        </DiagramFrame>
        <Facts
          items={[
            ['The database is the queue', 'An offline recipient needs no separate queue: the message is stored before anything is pushed, and the next history request returns it.'],
            ['Presence is memory', 'Online means “has at least one open socket”. It is volatile by nature, so it is never written to the database.'],
            ['Dead connections', 'The server pings every 25 s and drops a socket after 60 s of silence, so a phone that loses signal goes offline.'],
          ]}
        />
      </Chapter>

      <Chapter n="4" title="The human-in-the-loop approval">
        <DiagramFrame minWidth={900}>
          <Sequence
            colWidth={150}
            actors={[
              { id: 'alice', label: 'Alice', sub: 'operator', tone: 'blue' },
              { id: 'api', label: 'REST API', tone: 'muted' },
              { id: 'orch', label: 'Orchestrator', sub: '+ Gatekeeper', tone: 'purple' },
              { id: 'llm', label: 'Risk Analyst', sub: 'language model', tone: 'muted' },
              { id: 'hub', label: 'Realtime Relay', tone: 'ink' },
              { id: 'bob', label: 'Bob', sub: 'reviewer', tone: 'gold' },
            ]}
            steps={[
              { from: 'alice', to: 'api', label: 'POST /api/agent-runs', kind: 'rest', note: '202 Accepted, run is queued' },
              { from: 'api', to: 'orch', label: 'start run', kind: 'internal' },
              { from: 'orch', to: 'llm', label: 'analyze this invoice', kind: 'llm' },
              { from: 'llm', to: 'orch', label: 'JSON: risk, action, reason', kind: 'llm', note: 'validated against a strict schema' },
              { at: 'orch', note: 'Policy: flagging needs a human. Approval opened', tone: 'warning' },
              { from: 'orch', to: 'hub', label: 'approval_requested', kind: 'internal' },
              { from: 'hub', to: 'bob', label: 'push: new request', kind: 'ws', note: 'toast and inbox badge, instantly' },
              { from: 'bob', to: 'api', label: 'POST /approvals/{id}/decision', kind: 'rest', note: 'only the assigned reviewer, only once' },
              { from: 'api', to: 'orch', label: 'approved → run action once', kind: 'internal' },
              { at: 'orch', note: 'Case Action Executor flags the case', tone: 'success' },
              { from: 'hub', to: 'alice', label: 'push: run completed', kind: 'ws' },
            ]}
          />
        </DiagramFrame>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(['orchestrator', 'analyst', 'gatekeeper', 'executor'] as const).map((id) => (
            <div key={id} className="flex gap-3 rounded-2xl bg-bg-subtle p-4">
              <AgentAvatar agent={AGENTS[id]} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{AGENTS[id].name}</p>
                <p className="mt-0.5 text-13 text-text-secondary">{AGENTS[id].role}</p>
              </div>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="5" title="The life of a run">
        <DiagramFrame minWidth={860}>
          <RunStateMachine />
        </DiagramFrame>
        <Facts
          items={[
            ['One transition at a time', 'Every state change is a conditional update (“only if it is still Awaiting approval”), so two people clicking at once cannot both win.'],
            ['Failures never approve', 'A timeout, a model that is down or a malformed answer ends in Failed. Nothing is executed and nothing is guessed.'],
            ['Exactly once', 'The executed action is unique per approval in the database, so a double click or a restart cannot run it twice.'],
          ]}
        />
      </Chapter>

      <Chapter n="6" title="Who is allowed in">
        <DiagramFrame minWidth={760}>
          <Sequence
            actors={[
              { id: 'c', label: 'Browser', tone: 'blue' },
              { id: 'auth', label: 'Auth', sub: 'REST', tone: 'muted' },
              { id: 'ws', label: 'WebSocket', sub: '/ws/messages', tone: 'ink' },
            ]}
            colWidth={250}
            steps={[
              { from: 'c', to: 'auth', label: 'POST /api/auth/login', kind: 'rest', note: 'password checked with Argon2id' },
              { from: 'auth', to: 'c', label: '15-min access token + refresh cookie', kind: 'rest', note: 'token kept in memory only' },
              { from: 'c', to: 'auth', label: 'POST /api/auth/ws-ticket', kind: 'rest' },
              { from: 'auth', to: 'c', label: 'single-use ticket, valid 30 s', kind: 'rest' },
              { from: 'c', to: 'ws', label: 'connect ?ticket=…', kind: 'ws', note: 'origin checked; bad or expired ticket → 401' },
              { at: 'ws', note: 'Socket is bound to that user for its whole life', tone: 'success' },
            ]}
          />
        </DiagramFrame>
        <Facts
          items={[
            ['Every endpoint checks', 'All REST routes except sign-up and login need a valid token; anything else gets 401 Unauthorized.'],
            ['Why a ticket', 'Browsers cannot set headers on a WebSocket handshake. A 30-second ticket in the URL is safer than a long-lived token in logs.'],
            ['Identity from the server', 'The sender of a message is the authenticated user, whatever the client claims.'],
          ]}
        />
      </Chapter>
    </PageContainer>
  )
}

const CHANNELS: [string, 'rest' | 'ws', string][] = [
  ['Create an account, log in', 'rest', 'One request, one answer. Nothing to keep open.'],
  ['Message history', 'rest', 'A resource with an address: cacheable, pageable, works after any reconnect.'],
  ['Who is online, right now', 'rest', 'A snapshot when the page opens; changes then arrive on the socket.'],
  ['Cases, runs, approval decisions', 'rest', 'Ordinary reads and writes, each checked against the user’s role.'],
  ['Send and receive messages live', 'ws', 'The server must push to Bob without Bob asking. Polling would be slow and wasteful.'],
  ['Typing, presence changes', 'ws', 'Tiny, frequent, only useful right now.'],
  ['Run progress, approval requests', 'ws', 'So the reviewer sees a request the second it exists.'],
]

function ChannelPill({ kind }: { kind: 'rest' | 'ws' }) {
  return kind === 'rest' ? (
    <span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 text-xs font-medium text-text-on-ink">REST</span>
  ) : (
    <span className="inline-flex h-6 items-center rounded-full bg-accent-subtle px-2.5 text-xs font-medium text-accent-text">WebSocket</span>
  )
}

function Chapter({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-16 sm:mb-20" aria-labelledby={`ch-${n}`}>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-mono text-13 text-text-tertiary tabular-nums">0{n}</span>
        <h2 id={`ch-${n}`} className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-3">
      {items.map(([t, d]) => (
        <div key={t}>
          <dt className="text-sm font-semibold">{t}</dt>
          <dd className="mt-1 text-13 text-text-secondary">{d}</dd>
        </div>
      ))}
    </dl>
  )
}

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl bg-hue-blue-pale p-5 sm:p-6">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-sm text-text-secondary">{children}</p>
    </div>
  )
}
