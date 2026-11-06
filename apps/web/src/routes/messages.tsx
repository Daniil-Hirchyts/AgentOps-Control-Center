import { MessagesPage } from '@/features/messaging/messages-page'

export function MessagesRoute({ userId }: { userId?: number }) {
  return <MessagesPage selectedUserId={userId !== undefined && Number.isFinite(userId) ? userId : undefined} />
}
