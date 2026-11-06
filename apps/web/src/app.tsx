import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { setAuthFailureHandler } from '@/lib/api'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/hooks'
import { createQueryClient } from '@/lib/query-client'
import { createAppRouter, type AppRouter } from '@/router'
import { useRealtimeStore } from '@/stores/realtime'
import { useUiStore } from '@/stores/ui'

export function App({ router: injected, queryClient }: { router?: AppRouter; queryClient?: QueryClient } = {}) {
  const [qc] = useState(() => queryClient ?? createQueryClient())
  const [router] = useState(() => injected ?? createAppRouter())
  const theme = useUiStore((s) => s.theme)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  useEffect(() => {
    setAuthFailureHandler(() => {
      useRealtimeStore.getState().reset()
      qc.clear()
      const here = router.state.location.href
      void router.navigate({ to: '/login', search: here.startsWith('/login') ? {} : { redirect: here } })
    })
    return () => setAuthFailureHandler(null)
  }, [qc, router])

  return (
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
      {/* Bottom-right on desktop (away from navigation); top on phones, below the 48px app bar. */}
      <Toaster
        position={isDesktop ? 'bottom-right' : 'top-center'}
        visibleToasts={3}
        theme={theme}
        offset={20}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 56px)', left: 12, right: 12 }}
        gap={8}
      />
    </QueryClientProvider>
  )
}
