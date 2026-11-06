import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import type { AgentRunDto, CreateRunRequest, Id, RunStatus } from '@/lib/types'

const ACTIVE: ReadonlySet<RunStatus> = new Set(['PENDING', 'RUNNING', 'APPROVED'])

export function isRunActive(status: RunStatus) {
  return ACTIVE.has(status)
}

export function sortRunsDesc(runs: AgentRunDto[]): AgentRunDto[] {
  return [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
}

export function useRuns(q: { status?: RunStatus; caseId?: Id; limit?: number } = {}) {
  const params = { limit: 200, ...q }
  return useQuery({
    queryKey: qk.runList(params),
    queryFn: () => api.runs(params),
    select: (page) => ({ ...page, items: sortRunsDesc(page.items) }),
    // safety net in case a WS event is missed while a run is processing
    refetchInterval: (query) => (query.state.data?.items.some((r) => isRunActive(r.status)) ? 5000 : false),
  })
}

export function useRun(id: Id) {
  return useQuery({
    queryKey: qk.run(id),
    queryFn: () => api.run(id),
    refetchInterval: (query) => (query.state.data && isRunActive(query.state.data.status) ? 4000 : false),
  })
}

export function useCreateRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRunRequest) => api.createRun(body),
    onSuccess: (run) => {
      qc.setQueryData(qk.run(run.id), run)
      void qc.invalidateQueries({ queryKey: qk.runs })
      void qc.invalidateQueries({ queryKey: qk.cases })
    },
  })
}
