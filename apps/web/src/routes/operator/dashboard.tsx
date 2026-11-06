import { Link } from '@tanstack/react-router'
import { Activity, AlertTriangle, ArrowRight, Hourglass, ShieldAlert } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageContainer } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { RUN_STATUS_CHART_COLOR, RUN_STATUS_META } from '@/components/shared/status-meta'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRuns } from '@/features/agents/hooks'
import { RunsTable } from '@/features/agents/runs-table'
import { useApprovals } from '@/features/approvals/hooks'
import { useCases } from '@/features/cases/hooks'
import { NewCaseDialog } from '@/features/cases/new-case-dialog'
import { RUN_STATUSES } from '@/lib/types'
import { cn, humanize } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  footer,
  testId,
}: {
  label: string
  value: number | undefined
  icon: ComponentType<{ className?: string }>
  tone: string
  loading: boolean
  footer?: ReactNode
  testId: string
}) {
  return (
    <Card className="gap-2 py-4" data-testid={testId}>
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-12" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
          )}
        </div>
        <span className={cn('rounded-lg p-2', tone)}>
          <Icon className="size-4" />
        </span>
      </CardContent>
      {footer && <CardContent className="text-xs text-muted-foreground">{footer}</CardContent>}
    </Card>
  )
}

export function OperatorDashboard() {
  const username = useAuthStore((s) => s.user?.username)
  const runs = useRuns()
  const pending = useApprovals({ status: 'PENDING' })
  const cases = useCases()

  const items = runs.data?.items ?? []
  const byStatus = RUN_STATUSES.map((s) => ({
    status: s,
    label: RUN_STATUS_META[s].label ?? humanize(s),
    count: items.filter((r) => r.status === s).length,
  }))
  const active = items.filter((r) => r.status === 'PENDING' || r.status === 'RUNNING' || r.status === 'APPROVED').length
  const failed = items.filter((r) => r.status === 'FAILED').length
  const flagged = cases.data?.items.filter((c) => c.status === 'FLAGGED_FOR_REVIEW').length

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back${username ? `, ${username}` : ''}`}
        description="Overview of your AI investigations and pending human approvals."
        actions={<NewCaseDialog />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          testId="kpi-runs"
          label="Total runs"
          value={runs.data?.total}
          icon={Activity}
          tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
          loading={runs.isPending}
          footer={`${active} in progress`}
        />
        <Kpi
          testId="kpi-pending-approvals"
          label="Pending approvals"
          value={pending.data?.total}
          icon={Hourglass}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
          loading={pending.isPending}
          footer="Waiting on reviewers"
        />
        <Kpi
          testId="kpi-flagged"
          label="Flagged cases"
          value={flagged}
          icon={ShieldAlert}
          tone="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
          loading={cases.isPending}
          footer={`${cases.data?.total ?? 0} cases total`}
        />
        <Kpi
          testId="kpi-failed"
          label="Failed runs"
          value={runs.isPending ? undefined : failed}
          icon={AlertTriangle}
          tone="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          loading={runs.isPending}
          footer="LLM errors are never auto-approved"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/operator/runs">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-3">
            {runs.isPending ? (
              <ListSkeleton rows={5} />
            ) : runs.isError ? (
              <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No runs yet"
                description="Create an investigation and run the AI analysis to see results here."
              />
            ) : (
              <RunsTable runs={items.slice(0, 8)} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runs by status</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : items.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="h-64" role="img" aria-label="Bar chart of runs by status">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byStatus} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)' }}
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {byStatus.map((d) => (
                        <Cell key={d.status} fill={RUN_STATUS_CHART_COLOR[d.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
