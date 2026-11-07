import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react'
import { UserAvatar } from '@/components/shared/presence'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/features/auth/session'
import { ROLE_LABEL } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  if (!user) return null

  const onLogout = async () => {
    await logout(qc)
    void navigate({ to: '/login' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="user-menu"
          aria-label={`Account: ${user.username}`}
          className={cn(
            'pressable flex items-center gap-2.5 rounded-md text-start hover:bg-bg-muted',
            compact ? 'size-9 justify-center' : 'h-11 w-full px-2',
          )}
        >
          <UserAvatar username={user.username} size={compact ? 'sm' : 'md'} />
          {!compact && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-13 font-medium" data-testid="current-username">
                  {user.username}
                </span>
                <span className="block text-xs text-text-tertiary">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronsUpDown className="size-4 text-text-tertiary" strokeWidth={1.5} />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} side={compact ? 'bottom' : 'top'} className="w-56">
        <DropdownMenuLabel>
          <span className="block font-medium">{user.username}</span>
          <span className="block text-13 text-text-tertiary">{ROLE_LABEL[user.role]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={() => void onLogout()} data-testid="logout-button">
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
