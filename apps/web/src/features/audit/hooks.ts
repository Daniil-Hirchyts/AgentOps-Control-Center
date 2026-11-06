import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import type { AuditEventDto, Id } from '@/lib/types'

export function useAuditEvents(q: { agentRunId?: Id; limit?: number; offset?: number } = {}) {
  const params = { limit: 200, ...q }
  return useQuery({
    queryKey: qk.auditList(params),
    queryFn: () => api.auditEvents(params),
    select: (page) => ({ ...page, items: sortAuditAsc(page.items) }),
  })
}

export function sortAuditAsc(items: AuditEventDto[]): AuditEventDto[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
}
