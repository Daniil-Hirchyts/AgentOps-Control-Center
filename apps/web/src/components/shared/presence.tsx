import { ROLE_LABEL } from '@/lib/labels'
import type { Role } from '@/lib/types'
import { cn, initials } from '@/lib/utils'

export function PresenceDot({ online, username, className }: { online: boolean; username?: string; className?: string }) {
  return (
    <span
      data-testid={username ? `presence-${username}` : undefined}
      data-online={online ? 'true' : 'false'}
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        online ? 'bg-success-dot' : 'border border-neutral-dot bg-transparent',
        className,
      )}
    />
  )
}

/** Presence = dot + text label. */
export function PresenceLabel({ online, username, className }: { online: boolean; username?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <PresenceDot online={online} username={username} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

const SIZE = { xs: 'size-6 text-[10px]', sm: 'size-7 text-[11px]', md: 'size-8 text-xs', lg: 'size-9 text-xs' }

export function UserAvatar({
  username,
  online,
  size = 'md',
  className,
}: {
  username: string
  online?: boolean
  size?: keyof typeof SIZE
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'avatar-outline inline-flex items-center justify-center rounded-full bg-bg-muted font-medium text-text-secondary',
          SIZE[size],
        )}
        aria-hidden
      >
        {initials(username)}
      </span>
      {online !== undefined && (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-surface p-[2px]">
          <PresenceDot online={online} username={username} className="block" />
        </span>
      )}
    </span>
  )
}

export function RoleLabel({ role, className }: { role: Role; className?: string }) {
  return <span className={cn('text-text-tertiary', className)}>{ROLE_LABEL[role]}</span>
}
