import { useNavigate } from '@tanstack/react-router'
import { Bot, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/shared/presence'
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
      toast.success(`Analysis started (run #${run.id})`)
      setOpen(false)
      void navigate({ to: '/operator/runs/$runId', params: { runId: String(run.id) } })
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'llm_unavailable'
          ? 'The LLM is currently unavailable. Try again shortly.'
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
        <Button disabled={disabled} data-testid="run-analysis-button">
          <Bot /> Run AI analysis
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run AI analysis</DialogTitle>
          <DialogDescription>
            Choose the reviewer who must approve any action the agent proposes. Nothing is executed without their
            approval.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Reviewer" className="max-h-72 space-y-1.5 overflow-y-auto" data-testid="reviewer-picker">
          {users.isPending ? (
            <ListSkeleton rows={3} />
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : reviewers.length === 0 ? (
            <EmptyState title="No reviewers available" description="Register a REVIEWER account first." />
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
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    checked ? 'border-primary bg-accent/60' : 'hover:bg-muted/60',
                  )}
                >
                  <UserAvatar username={r.username} online={r.online} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{r.username}</span>
                    <span className="block text-xs text-muted-foreground">{r.online ? 'Online now' : 'Offline'}</span>
                  </span>
                  <span
                    className={cn(
                      'size-4 rounded-full border-2',
                      checked ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_var(--card)]' : 'border-muted-foreground/40',
                    )}
                  />
                </button>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={reviewerId === null || createRun.isPending} data-testid="start-run-submit">
            {createRun.isPending && <Loader2 className="animate-spin" />}
            Start analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
