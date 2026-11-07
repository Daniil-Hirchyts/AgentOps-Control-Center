import { AgentAvatar } from '@/components/shared/agent-avatar'
import { UserAvatar } from '@/components/shared/presence'
import { AGENTS, type AgentId } from '@/features/agents/agents'
import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md'

/** A person inline: portrait, then name. Use wherever a username appears in running text or a cell. */
export function Person({ username, size = 'xs', className }: { username: string; size?: Size; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle', className)}>
      <UserAvatar username={username} size={size} />
      <span className="truncate">{username}</span>
    </span>
  )
}

/** An agent inline: pattern avatar, then its name. */
export function Agent({ agent, size = 'xs', className }: { agent: AgentId; size?: Size; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle', className)}>
      <AgentAvatar agent={AGENTS[agent]} size={size} />
      <span className="truncate">{AGENTS[agent].name}</span>
    </span>
  )
}
