/**
 * Agent avatar: a squircle with a generic geometric pattern, one per agent, in the
 * family.co graphic hues. Squircle (not circle) so agents never read as people.
 */
import type { Agent, AgentId } from '@/features/agents/agents'
import { cn } from '@/lib/utils'

const SIZE = { xs: 'size-6', sm: 'size-7', md: 'size-8', lg: 'size-10', xl: 'size-14' } as const

const HUE: Record<Agent['hue'], { bg: string; fg: string }> = {
  blue: { bg: 'fill-hue-blue-pale', fg: 'fill-hue-blue' },
  purple: { bg: 'fill-hue-purple-pale', fg: 'fill-hue-purple' },
  gold: { bg: 'fill-hue-gold-pale', fg: 'fill-hue-gold' },
  green: { bg: 'fill-hue-green-pale', fg: 'fill-hue-green' },
  orange: { bg: 'fill-hue-orange-pale', fg: 'fill-hue-orange' },
}

function Pattern({ id, fg }: { id: AgentId; fg: string }) {
  switch (id) {
    case 'analyst': // concentric rings: a scanner
      return (
        <g>
          <circle cx="20" cy="20" r="12" className={fg} />
          <circle cx="20" cy="20" r="8" className="fill-hue-blue-pale" />
          <circle cx="20" cy="20" r="4" className="fill-hue-ink" />
          <circle cx="23" cy="17" r="1.3" className="fill-white" />
        </g>
      )
    case 'orchestrator': // four quarter circles turning: the state machine
      return (
        <g className={fg}>
          <path d="M8 20a12 12 0 0 1 12-12v12z" />
          <path d="M20 8a12 12 0 0 1 12 12H20z" opacity=".55" />
          <path d="M32 20a12 12 0 0 1-12 12V20z" />
          <path d="M20 32A12 12 0 0 1 8 20h12z" opacity=".55" />
          <circle cx="20" cy="20" r="3" className="fill-hue-ink" />
        </g>
      )
    case 'gatekeeper': // a closed gate: two posts and a bar
      return (
        <g>
          <rect x="9" y="11" width="5" height="19" rx="2.5" className={fg} />
          <rect x="26" y="11" width="5" height="19" rx="2.5" className={fg} />
          <rect x="9" y="18" width="22" height="5" rx="2.5" className="fill-hue-ink" />
        </g>
      )
    case 'executor': // stacked chevrons: forward, once
      return (
        <g className={fg}>
          <path d="M10 12l7 8-7 8h6l7-8-7-8z" />
          <path d="M19 12l7 8-7 8h6l7-8-7-8z" opacity=".55" />
        </g>
      )
    case 'relay': // three nodes linked through a hub
      return (
        <g>
          <path d="M11 13L20 20M29 13L20 20M20 20V30" strokeWidth="2.5" strokeLinecap="round" className="stroke-hue-ink" fill="none" />
          <circle cx="11" cy="13" r="4" className={fg} />
          <circle cx="29" cy="13" r="4" className={fg} />
          <circle cx="20" cy="30" r="4" className={fg} />
          <circle cx="20" cy="20" r="3" className="fill-hue-ink" />
        </g>
      )
  }
}

export function AgentAvatar({ agent, size = 'md', className }: { agent: Agent; size?: keyof typeof SIZE; className?: string }) {
  const hue = HUE[agent.hue]
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('shrink-0', SIZE[size], className)}
      role="img"
      aria-label={agent.name}
      data-testid={`agent-avatar-${agent.id}`}
    >
      <rect width="40" height="40" rx="12" className={hue.bg} />
      <Pattern id={agent.id} fg={hue.fg} />
    </svg>
  )
}
