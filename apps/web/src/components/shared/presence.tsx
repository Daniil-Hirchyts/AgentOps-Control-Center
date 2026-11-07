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
        online ? 'bg-success-solid' : 'border border-neutral-solid bg-transparent',
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

const SIZE = {
  xs: 'size-6 text-[10px]',
  sm: 'size-7 text-[11px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-13',
  xl: 'size-14 text-base',
}

/** Illustrated portraits for the demo accounts (fictional people, generated for this project). */
const PORTRAITS = new Set(['alice', 'carol', 'bob', 'dave'])

const FALLBACK_HUES = [
  'bg-hue-blue-pale text-text',
  'bg-hue-green-pale text-text',
  'bg-hue-purple-pale text-text',
  'bg-hue-orange-pale text-text',
  'bg-hue-gold-pale text-text',
  'bg-hue-pink-pale text-text',
]

function hueFor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_HUES[h % FALLBACK_HUES.length]!
}

/** People are circles with a face (or initials on a soft hue); agents are squircles with a pattern. */
export function UserAvatar({
  username,
  online,
  size = 'md',
  className,
  dotTestId = true,
}: {
  username: string
  online?: boolean
  size?: keyof typeof SIZE
  className?: string
  /** Off for the signed-in user's own avatar, where the dot shows the realtime connection. */
  dotTestId?: boolean
}) {
  const portrait = PORTRAITS.has(username.toLowerCase())
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {portrait ? (
        <img
          src={`/avatars/${username.toLowerCase()}.webp`}
          alt=""
          aria-hidden
          draggable={false}
          className={cn('avatar-outline rounded-full bg-bg-muted object-cover', SIZE[size])}
        />
      ) : (
        <span
          className={cn('avatar-outline inline-flex items-center justify-center rounded-full font-medium', hueFor(username), SIZE[size])}
          aria-hidden
        >
          {initials(username)}
        </span>
      )}
      {online !== undefined && (
        <span className="absolute -end-0.5 -bottom-0.5 rounded-full bg-bg-surface p-[2px]">
          <PresenceDot online={online} username={dotTestId ? username : undefined} className="block" />
        </span>
      )}
    </span>
  )
}

export function RoleLabel({ role, className }: { role: Role; className?: string }) {
  return <span className={cn('text-text-tertiary', className)}>{ROLE_LABEL[role]}</span>
}
