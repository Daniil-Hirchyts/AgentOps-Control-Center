import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { vi } from 'vitest'
import type { Role, UserDto } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

export function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
}

/** Render a component inside QueryClient + a throwaway router (so <Link> works). */
export function renderWithProviders(ui: ReactNode, { path = '/', qc = testQueryClient() } = {}) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {ui}
        <Toaster />
      </>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const utils = render(
    <QueryClientProvider client={qc}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </QueryClientProvider>,
  )
  return { ...utils, qc, router }
}

export function makeUser(over: Partial<UserDto> & { id: number; username: string; role?: Role }): UserDto {
  return { role: 'OPERATOR', online: true, createdAt: '2026-09-01T08:00:00Z', ...over }
}

export function signIn(user: UserDto) {
  useAuthStore.setState({ accessToken: 'test-token', user, status: 'authenticated' })
}

type Handler = (req: { url: URL; method: string; body: unknown; init?: RequestInit }) =>
  | { status?: number; body?: unknown }
  | Promise<{ status?: number; body?: unknown }>
  | 'pending'

export interface Route {
  method?: string
  path: string | RegExp
  handler: Handler
}

/** Tiny fetch router. Unmatched requests return 404 with the contract error shape. */
export function mockFetch(routes: Route[]) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost')
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const route = routes.find(
      (r) =>
        (r.method ?? 'GET').toUpperCase() === method &&
        (typeof r.path === 'string' ? url.pathname === r.path : r.path.test(url.pathname)),
    )
    if (!route) return json(404, { error: { code: 'not_found', message: `no mock for ${method} ${url.pathname}` } })
    const res = await route.handler({ url, method, body, init })
    if (res === 'pending') return new Promise<Response>(() => {})
    return json(res.status ?? 200, res.body)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function json(status: number, body: unknown): Response {
  return new Response(body === undefined || status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function callsTo(fetchMock: ReturnType<typeof mockFetch>, path: string, method = 'GET') {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url = new URL(String(input), 'http://localhost')
    return url.pathname === path && (init?.method ?? 'GET').toUpperCase() === method
  })
}
