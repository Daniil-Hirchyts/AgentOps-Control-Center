import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
  lazyRouteComponent,
  Navigate,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { RealtimeProvider } from '@/components/realtime-provider'
import { RUN_STATUSES, type Role, type RunStatus } from '@/lib/types'
import { homePathForRole, useAuthStore } from '@/stores/auth'
import { LoginPage } from '@/routes/login'
import { MessagesRoute } from '@/routes/messages'
import { NotFoundPage } from '@/routes/not-found'
import { AuditPage } from '@/routes/operator/audit'
import { CaseDetailPage } from '@/routes/operator/case-detail'
import { CasesPage } from '@/routes/operator/cases'
import { RunDetailPage } from '@/routes/operator/run-detail'
import { RunsPage } from '@/routes/operator/runs'
import { RegisterPage } from '@/routes/register'
import { ApprovalDetailPage } from '@/routes/reviewer/approval-detail'
import { ReviewerInbox } from '@/routes/reviewer/inbox'

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
})

function redirectIfAuthenticated() {
  const { status, user } = useAuthStore.getState()
  if (status === 'authenticated') throw redirect({ to: homePathForRole(user?.role) })
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === 'string' && s.redirect.startsWith('/') ? { redirect: s.redirect } : {},
  beforeLoad: redirectIfAuthenticated,
  component: function LoginRoute() {
    const { redirect: redirectTo } = loginRoute.useSearch()
    return <LoginPage redirectTo={redirectTo} />
  },
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: redirectIfAuthenticated,
  component: RegisterPage,
})

/** Guarded layout: everything below requires a session. */
function AuthenticatedLayout() {
  const status = useAuthStore((s) => s.status)
  if (status !== 'authenticated') return <Navigate to="/login" />
  return (
    <RealtimeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </RealtimeProvider>
  )
}

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ location }) => {
    if (useAuthStore.getState().status !== 'authenticated') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: homePathForRole(useAuthStore.getState().user?.role) })
  },
})

/** Client-side role gate (the backend remains authoritative). */
function requireRole(role: Role) {
  return () => {
    const user = useAuthStore.getState().user
    if (user && user.role !== role) throw redirect({ to: homePathForRole(user.role) })
  }
}

// --- operator ---------------------------------------------------------------
const operatorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'operator',
  beforeLoad: requireRole('OPERATOR'),
  component: Outlet,
})
const operatorIndexRoute = createRoute({
  getParentRoute: () => operatorRoute,
  path: '/',
  // lazy: keeps Recharts out of the main bundle
  component: lazyRouteComponent(() => import('@/routes/operator/dashboard'), 'OperatorDashboard'),
})
const casesRoute = createRoute({ getParentRoute: () => operatorRoute, path: 'cases', component: CasesPage })
export const caseDetailRoute = createRoute({
  getParentRoute: () => operatorRoute,
  path: 'cases/$caseId',
  component: function CaseDetailRoute() {
    const { caseId } = caseDetailRoute.useParams()
    return <CaseDetailPage key={caseId} caseId={Number(caseId)} />
  },
})
export const runsRoute = createRoute({
  getParentRoute: () => operatorRoute,
  path: 'runs',
  validateSearch: (s: Record<string, unknown>): { status?: RunStatus } =>
    typeof s.status === 'string' && (RUN_STATUSES as readonly string[]).includes(s.status)
      ? { status: s.status as RunStatus }
      : {},
  component: function RunsRoute() {
    const { status } = runsRoute.useSearch()
    const navigate = runsRoute.useNavigate()
    return <RunsPage status={status} onStatusChange={(s) => void navigate({ search: s ? { status: s } : {} })} />
  },
})
export const runDetailRoute = createRoute({
  getParentRoute: () => operatorRoute,
  path: 'runs/$runId',
  component: function RunDetailRoute() {
    const { runId } = runDetailRoute.useParams()
    return <RunDetailPage key={runId} runId={Number(runId)} />
  },
})
export const auditRoute = createRoute({
  getParentRoute: () => operatorRoute,
  path: 'audit',
  validateSearch: (s: Record<string, unknown>): { agentRunId?: number } => {
    const n = Number(s.agentRunId)
    return Number.isInteger(n) && n > 0 ? { agentRunId: n } : {}
  },
  component: function AuditRoute() {
    const { agentRunId } = auditRoute.useSearch()
    const navigate = auditRoute.useNavigate()
    return (
      <AuditPage
        agentRunId={agentRunId}
        onRunChange={(id) => void navigate({ search: id ? { agentRunId: id } : {} })}
      />
    )
  },
})

// --- reviewer ---------------------------------------------------------------
const reviewerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reviewer',
  beforeLoad: requireRole('REVIEWER'),
  component: Outlet,
})
const reviewerIndexRoute = createRoute({ getParentRoute: () => reviewerRoute, path: '/', component: ReviewerInbox })
export const approvalDetailRoute = createRoute({
  getParentRoute: () => reviewerRoute,
  path: 'approvals/$approvalId',
  component: function ApprovalDetailRoute() {
    const { approvalId } = approvalDetailRoute.useParams()
    return <ApprovalDetailPage key={approvalId} approvalId={Number(approvalId)} />
  },
})

// --- messaging (both roles) -------------------------------------------------
const messagesRoute = createRoute({ getParentRoute: () => appRoute, path: 'messages', component: Outlet })
const messagesIndexRoute = createRoute({
  getParentRoute: () => messagesRoute,
  path: '/',
  component: () => <MessagesRoute />,
})
export const conversationRoute = createRoute({
  getParentRoute: () => messagesRoute,
  path: '$userId',
  component: function ConversationRoute() {
    const { userId } = conversationRoute.useParams()
    return <MessagesRoute userId={Number(userId)} />
  },
})

const learnRoute = createRoute({ getParentRoute: () => appRoute, path: 'learn', component: Outlet })
const conceptRoute = createRoute({
  getParentRoute: () => learnRoute,
  path: 'concept',
  component: lazyRouteComponent(() => import('@/routes/learn/concept'), 'ConceptPage'),
})
const architectureRoute = createRoute({
  getParentRoute: () => learnRoute,
  path: 'architecture',
  component: lazyRouteComponent(() => import('@/routes/learn/architecture'), 'ArchitecturePage'),
})

export const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  appRoute.addChildren([
    indexRoute,
    operatorRoute.addChildren([operatorIndexRoute, casesRoute, caseDetailRoute, runsRoute, runDetailRoute, auditRoute]),
    reviewerRoute.addChildren([reviewerIndexRoute, approvalDetailRoute]),
    messagesRoute.addChildren([messagesIndexRoute, conversationRoute]),
    learnRoute.addChildren([conceptRoute, architectureRoute]),
  ]),
])

export function createAppRouter(opts: { history?: RouterHistory } = {}) {
  return createRouter({
    routeTree,
    history: opts.history,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
