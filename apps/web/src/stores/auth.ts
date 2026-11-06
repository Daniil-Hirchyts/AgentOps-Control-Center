import { create } from 'zustand'
import type { LoginResponse, Role, UserDto } from '@/lib/types'

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous'

interface AuthState {
  /** JWT access token — kept in memory only, never persisted. */
  accessToken: string | null
  user: UserDto | null
  status: AuthStatus
  setSession: (session: LoginResponse) => void
  setUser: (user: UserDto) => void
  clear: () => void
  markAnonymous: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: 'booting',
  setSession: (session) => set({ accessToken: session.accessToken, user: session.user, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null, status: 'anonymous' }),
  markAnonymous: () => set({ status: 'anonymous' }),
}))

export function homePathForRole(role: Role | undefined): '/operator' | '/reviewer' {
  return role === 'REVIEWER' ? '/reviewer' : '/operator'
}
