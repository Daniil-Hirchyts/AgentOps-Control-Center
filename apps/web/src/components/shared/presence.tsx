import { cn, initials } from '@/lib/utils'
import type { Role } from '@/lib/types'

export function PresenceDot({ online, username, className }: { online: boolean; username?: string; className?: string }) {
  return (
    <span
      data-testid={username ? `presence-${username}` : undefined}
      data-online={online ? 'true' : 'false'}
      title={online ? 'Online' : 'Offline'}
      aria-label={online ? 'Online' : 'Offline'}
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full ring-2 ring-card',
        online ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600',
        className,
      )}
    />
  )
}

const avatarTone = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
]

export function UserAvatar({
  username,
  online,
  size = 'md',
  className,
}: {
  username: string
  online?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const tone = avatarTone[[...username].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarTone.length]
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold',
          size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs',
          tone,
        )}
        aria-hidden
      >
        {initials(username)}
      </span>
      {online !== undefined && (
        <PresenceDot online={online} username={username} className="absolute -right-0.5 -bottom-0.5" />
      )}
    </span>
  )
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        role === 'REVIEWER'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
        className,
      )}
    >
      {role === 'REVIEWER' ? 'Reviewer' : 'Operator'}
    </span>
  )
}
