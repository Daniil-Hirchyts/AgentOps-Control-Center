import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { CircularLoader } from '@/components/prompt-kit/loader'
import { PresenceLabel, UserAvatar } from '@/components/shared/presence'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useUsers } from '@/features/messaging/hooks'
import { ApiError, errorMessage } from '@/lib/api'
import type { Id } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useCreateRun } from './hooks'

export function RunAnalysisDialog({ caseId, disabled }: { caseId: Id; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [reviewerId, setReviewerId] = useState<Id | null>(null)
  const meId = useAuthStore((s) => s.user?.id)
  const users = useUsers()
  const createRun = useCreateRun()
  const navigate = useNavigate()

  const reviewers = (users.data ?? [])
    .filter((u) => u.role === 'REVIEWER' && u.id !== meId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username))

  const submit = async () => {
    if (reviewerId === null) return
    try {
      const run = await createRun.mutateAsync({ caseId, reviewerId })
      toast.success(`Analysis started · Run #${run.id}`)
      setOpen(false)
      void navigate({ to: '/operator/runs/$runId', params: { runId: String(run.id) } })
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'llm_unavailable'
          ? 'The model is unavailable right now. Try again in a moment.'
          : errorMessage(err)
      toast.error('Could not start analysis', { description: msg })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setReviewerId(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary" disabled={disabled} data-testid="run-analysis-button">
          Run analysis
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run analysis</DialogTitle>
          <DialogDescription>
            Pick the reviewer who approves the agent’s recommendation. Nothing is executed without their decision.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Reviewer" className="-mx-1 max-h-72 space-y-1 overflow-y-auto overscroll-contain px-1 py-1" data-testid="reviewer-picker">
          {users.isPending ? (
            <ListSkeleton rows={3} avatar />
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : reviewers.length === 0 ? (
            <EmptyState title="No reviewers yet" description="Someone needs a reviewer account before you can run an analysis." />
          ) : (
            reviewers.map((r) => {
              const checked = reviewerId === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  data-testid={`reviewer-option-${r.username}`}
                  onClick={() => setReviewerId(r.id)}
                  className={cn(
                    'pressable flex h-14 w-full items-center gap-3 rounded-lg border px-3 text-left',
                    checked ? 'border-accent-solid bg-accent-subtle' : 'hover:bg-bg-subtle',
                  )}
                >
                  <UserAvatar username={r.username} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{r.username}</span>
                    <PresenceLabel online={r.online} className="text-13 text-text-secondary" />
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 rounded-full border',
                      checked ? 'border-[5px] border-accent-solid' : 'border-border-strong',
                    )}
                  />
                </button>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={reviewerId === null || createRun.isPending}
            data-testid="start-run-submit"
          >
            {createRun.isPending && <CircularLoader size="sm" className="text-current" />}
            Start analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
