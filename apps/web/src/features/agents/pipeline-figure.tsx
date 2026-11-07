/**
 * The run's pipeline as a framed figure: the isometric agent line on top, the 2D track
 * underneath. Card corners follow the Anatomy plate: figure number, title, hint, live readout.
 */
import type { AgentRunDto } from '@/lib/types'
import { cn } from '@/lib/utils'
import { currentStage, pipelineOf } from './pipeline'
import { PipelineMachine } from './pipeline-machine'
import { PipelineTrack } from './pipeline-track'

type RunLike = Pick<AgentRunDto, 'id' | 'status' | 'output' | 'approval' | 'error'>

export function PipelineFigure({ run, className }: { run: RunLike; className?: string }) {
  const stages = pipelineOf(run)
  const stage = stages.find((s) => s.id === currentStage(run))!
  const live = run.status !== 'COMPLETED' && run.status !== 'CANCELLED' && run.status !== 'FAILED'
  return (
    <figure className={cn('surface overflow-hidden rounded-xl', className)} data-testid="pipeline-figure">
      <div className="relative px-2 pt-9 pb-8 sm:px-6">
        <div className="pointer-events-none absolute inset-x-4 inset-y-3.5 font-mono text-[10.5px] tracking-[0.04em] text-text-tertiary sm:inset-x-5" aria-hidden>
          <span className="absolute start-0 top-0 text-text-secondary">Fig. 1</span>
          <span className="absolute end-0 top-0 tracking-[0.1em] uppercase">Agent line · run #{run.id}</span>
          <span className="absolute start-0 bottom-0 tracking-[0.1em] uppercase">{live ? 'Live' : 'Final state'}</span>
          <span className="absolute end-0 bottom-0 text-text-secondary tabular-nums" data-testid="pipeline-readout">
            {stage.label} · {stage.detail}
          </span>
        </div>
        <PipelineMachine run={run} className="mx-auto max-w-4xl" />
      </div>
      <figcaption className="border-t border-separator px-4 py-4 sm:px-6">
        <PipelineTrack run={run} />
      </figcaption>
    </figure>
  )
}
