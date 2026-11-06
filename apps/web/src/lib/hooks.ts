import { useEffect, useSyncExternalStore } from 'react'

const APP_NAME = 'AgentOps'

/** Sets `document.title` for the current route (DESIGN §6). */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}

/** Subscribes to a CSS media query. Falls back to `false` where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia?.(query)
      mql?.addEventListener?.('change', cb)
      return () => mql?.removeEventListener?.('change', cb)
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}

export const DESKTOP_QUERY = '(min-width: 768px)'
