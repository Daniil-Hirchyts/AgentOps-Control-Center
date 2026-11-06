import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { setAuthFailureHandler } from '@/lib/api'
import { createQueryClient } from '@/lib/query-client'
import { createAppRouter, type AppRouter } from '@/router'
import { useRealtimeStore } from '@/stores/realtime'
import { useUiStore } from '@/stores/ui'

export function App({ router: injected, queryClient }: { router?: AppRouter; queryClient?: QueryClient } = {}) {
  const [qc] = useState(() => queryClient ?? createQueryClient())
  const [router] = useState(() => injected ?? createAppRouter())
  const theme = useUiStore((s) => s.theme)

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
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton theme={theme} />
    </QueryClientProvider>
  )
}
