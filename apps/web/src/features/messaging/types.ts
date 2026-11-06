import type { MessageDto } from '@/lib/types'

export type DeliveryState = 'sending' | 'sent' | 'failed'

/** Conversation cache entry: server message, or an optimistic one awaiting the WS echo. */
export interface ChatMessage extends MessageDto {
  clientMessageId?: string
  delivery?: DeliveryState
  failureReason?: string
}

export const MAX_MESSAGE_LENGTH = 4000
