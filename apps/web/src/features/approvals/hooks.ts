import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import type { ApprovalDto, ApprovalStatus, DecisionRequest, Id } from '@/lib/types'

/** Pending first, then most recent. */
export function sortApprovals(items: ApprovalDto[]): ApprovalDto[] {
  return [...items].sort((a, b) => {
    const pa = a.status === 'PENDING' ? 0 : 1
    const pb = b.status === 'PENDING' ? 0 : 1
    return pa - pb || b.createdAt.localeCompare(a.createdAt) || b.id - a.id
  })
}

export function useApprovals(q: { status?: ApprovalStatus; limit?: number } = {}, opts: { enabled?: boolean } = {}) {
  const params = { limit: 200, ...q }
  return useQuery({
    enabled: opts.enabled ?? true,
    queryKey: qk.approvalList(params),
    queryFn: () => api.approvals(params),
    select: (page) => ({ ...page, items: sortApprovals(page.items) }),
  })
}

export function useApproval(id: Id) {
  return useQuery({ queryKey: qk.approval(id), queryFn: () => api.approval(id) })
}

export function useDecision(id: Id) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DecisionRequest) => api.decide(id, body),
    onSuccess: (approval) => {
      qc.setQueryData(qk.approval(id), approval)
      void qc.invalidateQueries({ queryKey: qk.approvals })
      void qc.invalidateQueries({ queryKey: qk.runs })
    },
  })
}
