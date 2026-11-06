import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import type { CreateCaseRequest, Id } from '@/lib/types'

export function useCases(limit = 200) {
  return useQuery({ queryKey: qk.caseList({ limit }), queryFn: () => api.cases({ limit }) })
}

export function useCase(id: Id) {
  return useQuery({ queryKey: qk.case(id), queryFn: () => api.case(id) })
}

export function useCreateCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCaseRequest) => api.createCase(body),
    onSuccess: (created) => {
      qc.setQueryData(qk.case(created.id), created)
      void qc.invalidateQueries({ queryKey: qk.cases })
    },
  })
}
