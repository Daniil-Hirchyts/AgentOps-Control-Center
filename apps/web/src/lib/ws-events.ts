import { z } from 'zod'

/**
 * Runtime validation for every WebSocket payload (server → client).
 * Unknown `type`s are ignored safely; malformed known types are rejected.
 */

const id = z.number().int()
const ts = z.string().min(1)
const runStatus = z.enum([
  'PENDING',
  'RUNNING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
])

export const messageEventSchema = z.object({
  type: z.literal('message'),
  id,
  expediteurId: id,
  destinataireId: id,
  contenu: z.string(),
  dateEnvoi: ts,
  clientMessageId: z.string().nullish(),
})

export const presenceEventSchema = z.object({
  type: z.literal('user_presence'),
  userId: id,
  username: z.string(),
  online: z.boolean(),
})

export const typingEventSchema = z.object({
  type: z.literal('typing'),
  expediteurId: id,
  destinataireId: id,
  isTyping: z.boolean(),
})

export const agentStatusEventSchema = z.object({
  type: z.literal('agent_status'),
  runId: id,
  caseId: id,
  status: runStatus,
  updatedAt: ts,
})

export const approvalRequestedEventSchema = z.object({
  type: z.literal('approval_requested'),
  approvalId: id,
  runId: id,
  caseId: id,
  caseTitle: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  proposedAction: z.enum(['flag_invoice_for_review', 'no_action']),
  requestedBy: id,
  createdAt: ts,
})

export const approvalResolvedEventSchema = z.object({
  type: z.literal('approval_resolved'),
  approvalId: id,
  runId: id,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  decidedBy: id.nullish(),
  decidedAt: ts.nullish(),
})

export const errorEventSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
  clientMessageId: z.string().nullish(),
})

export const serverEventSchema = z.discriminatedUnion('type', [
  messageEventSchema,
  presenceEventSchema,
  typingEventSchema,
  agentStatusEventSchema,
  approvalRequestedEventSchema,
  approvalResolvedEventSchema,
  errorEventSchema,
])

export type ServerEvent = z.infer<typeof serverEventSchema>
export type ServerEventType = ServerEvent['type']
export type MessageEvent = z.infer<typeof messageEventSchema>
export type ErrorEvent = z.infer<typeof errorEventSchema>

export const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set<ServerEventType>([
  'message',
  'user_presence',
  'typing',
  'agent_status',
  'approval_requested',
  'approval_resolved',
  'error',
])

export type ParseResult =
  | { ok: true; event: ServerEvent }
  | { ok: false; reason: 'invalid_json' | 'unknown_type' | 'invalid_payload'; detail?: string }

/** Parse a raw WS frame (string or already-decoded object). Never throws. */
export function parseServerEvent(raw: unknown): ParseResult {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, reason: 'invalid_json' }
    }
  }
  if (typeof data !== 'object' || data === null || typeof (data as { type?: unknown }).type !== 'string') {
    return { ok: false, reason: 'invalid_payload', detail: 'missing type' }
  }
  if (!KNOWN_EVENT_TYPES.has((data as { type: string }).type)) {
    return { ok: false, reason: 'unknown_type', detail: (data as { type: string }).type }
  }
  const parsed = serverEventSchema.safeParse(data)
  if (!parsed.success) return { ok: false, reason: 'invalid_payload', detail: parsed.error.message }
  return { ok: true, event: parsed.data }
}

// Client → server frames ------------------------------------------------------

export interface OutgoingMessageFrame {
  type: 'message'
  destinataireId: number
  contenu: string
  clientMessageId: string
  /** Ignored by the server; kept for assignment-format compatibility. */
  expediteurId: number
  /** Ignored by the server; kept for assignment-format compatibility. */
  dateEnvoi: string
}

export interface OutgoingTypingFrame {
  type: 'typing'
  destinataireId: number
  isTyping: boolean
}

export type ClientFrame = OutgoingMessageFrame | OutgoingTypingFrame
