/**
 * The cast of non-human actors. Every automated step in the system belongs to one of
 * these agents, so the UI can say *who* did something instead of "System".
 * All of them run inside the one Rust server; they are roles, not separate processes.
 */
export type AgentId = 'analyst' | 'orchestrator' | 'gatekeeper' | 'executor' | 'relay'

export interface Agent {
  id: AgentId
  name: string
  /** One line: what this agent is responsible for. */
  role: string
  hue: 'blue' | 'purple' | 'gold' | 'green' | 'orange'
}

export const AGENTS: Record<AgentId, Agent> = {
  analyst: {
    id: 'analyst',
    name: 'Invoice Risk Analyst',
    role: 'Reads the invoice, compares it with the vendor’s history and proposes an action. The language model.',
    hue: 'blue',
  },
  orchestrator: {
    id: 'orchestrator',
    name: 'Run Orchestrator',
    role: 'Moves each run through its states, retries the model once and recovers runs after a restart.',
    hue: 'purple',
  },
  gatekeeper: {
    id: 'gatekeeper',
    name: 'Approval Gatekeeper',
    role: 'Opens an approval for the chosen reviewer and keeps the action locked until a human decides.',
    hue: 'gold',
  },
  executor: {
    id: 'executor',
    name: 'Case Action Executor',
    role: 'Runs the approved action exactly once, from a fixed allow-list. Never acts without an approval.',
    hue: 'green',
  },
  relay: {
    id: 'relay',
    name: 'Realtime Relay',
    role: 'The WebSocket hub: pushes messages, typing, presence and run events to every open device. Offline people get them from the database later.',
    hue: 'orange',
  },
}

const EVENT_AGENT: Record<string, AgentId> = {
  llm_request: 'analyst',
  llm_response_valid: 'analyst',
  llm_response_invalid: 'analyst',
  llm_error: 'analyst',
  llm_unavailable: 'analyst',
  run_created: 'orchestrator',
  run_status_changed: 'orchestrator',
  run_recovered: 'orchestrator',
  approval_requested: 'gatekeeper',
  action_executed: 'executor',
  action_skipped: 'executor',
}

/** The agent behind an audit event that has no human actor. */
export function agentForEvent(eventType: string): Agent {
  return AGENTS[EVENT_AGENT[eventType] ?? 'orchestrator']
}
