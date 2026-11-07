/** The run's pipeline as a card: where the run is now, then the five stages. */
import type { AgentRunDto } from '@/lib/types'
import { cn } from '@/lib/utils'
import { currentStage, pipelineOf } from './pipeline'
import { PipelineTrack } from './pipeline-track'

type RunLike = Pick<AgentRunDto, 'status' | 'output' | 'approval' | 'error'>

export function PipelineCard({ run, className }: { run: RunLike; className?: string }) {
  const stage = pipelineOf(run).find((s) => s.id === currentStage(run))!
  return (
    <section className={cn('surface rounded-2xl p-5 sm:p-6', className)} aria-label="Pipeline" data-testid="pipeline-card">
      <p className="mb-5 text-13 text-text-secondary" data-testid="pipeline-readout">
        <span className="font-medium text-text">{stage.label}</span>
        {stage.detail && <> · {stage.detail}</>}
      </p>
      <PipelineTrack run={run} />
    </section>
  )
}
