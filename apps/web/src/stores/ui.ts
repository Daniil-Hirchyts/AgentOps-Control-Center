import { create } from 'zustand'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = window.localStorage.getItem('agentops-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface UiState {
  theme: Theme
  toggleTheme: () => void
}

/** UI preferences only (theme is not sensitive, so it may live in localStorage). */
export const useUiStore = create<UiState>()((set, get) => ({
  theme: initialTheme(),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    try {
      window.localStorage.setItem('agentops-theme', theme)
    } catch {
      /* ignore */
    }
    applyTheme(theme)
    set({ theme })
  },
}))
