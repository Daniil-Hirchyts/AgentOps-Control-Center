import { AlertTriangle, Ban, CheckCircle2, Clock, Hourglass, Loader2, XCircle } from 'lucide-react'
import type { ComponentType } from 'react'
import type { RunStatus } from '@/lib/types'

export type Tone = 'neutral' | 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'

export interface Meta {
  tone: Tone
  icon: ComponentType<{ className?: string }>
  label?: string
  spin?: boolean
}

export const RUN_STATUS_META: Record<RunStatus, Meta> = {
  PENDING: { tone: 'neutral', icon: Clock },
  RUNNING: { tone: 'progress', icon: Loader2, spin: true },
  AWAITING_APPROVAL: { tone: 'warning', icon: Hourglass, label: 'Awaiting approval' },
  APPROVED: { tone: 'info', icon: CheckCircle2 },
  REJECTED: { tone: 'danger', icon: XCircle },
  COMPLETED: { tone: 'success', icon: CheckCircle2 },
  CANCELLED: { tone: 'muted', icon: Ban },
  FAILED: { tone: 'danger', icon: AlertTriangle },
}

export const RUN_STATUS_CHART_COLOR: Record<RunStatus, string> = {
  PENDING: '#a1a1aa',
  RUNNING: '#6366f1',
  AWAITING_APPROVAL: '#f59e0b',
  APPROVED: '#0ea5e9',
  REJECTED: '#ef4444',
  COMPLETED: '#10b981',
  CANCELLED: '#71717a',
  FAILED: '#dc2626',
}
