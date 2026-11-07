import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useEffect } from 'react'
import { PresenceDot, UserAvatar } from '@/components/shared/presence'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/lib/hooks'
import { ROLE_LABEL } from '@/lib/labels'
import type { Id } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import { Composer } from './composer'
import { useContacts, useConversation, useSendMessage, useTypingEmitter } from './hooks'
import { MessageList } from './message-list'
import { TypingIndicator } from './typing-indicator'

export function ConversationView({ userId }: { userId: Id }) {
  const me = useAuthStore((s) => s.user)
  const { contacts, isPending: usersPending } = useContacts()
  const contact = contacts.find((c) => c.id === userId)
  const conversation = useConversation(userId)
  const { sendText, retry, discard } = useSendMessage(userId)
  const typingEmitter = useTypingEmitter(userId)
  const isTyping = useRealtimeStore((s) => Boolean(s.typing[userId]))
  const wsStatus = useRealtimeStore((s) => s.wsStatus)
  const setActive = useRealtimeStore((s) => s.setActiveConversation)
  useDocumentTitle(contact ? contact.username : 'Messages')

  useEffect(() => {
    setActive(userId)
    return () => setActive(null)
  }, [userId, setActive])

  if (!me) return null
  const notFound = !usersPending && !contact
  const disconnected = wsStatus === 'reconnecting' || wsStatus === 'offline'

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="conversation">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-bg pe-4 ps-1 sm:gap-3 pt-[env(safe-area-inset-top)] sm:px-6 md:pt-0">
        <Link
          to="/messages"
          aria-label="Back to conversations"
          className="pressable inline-flex size-10 items-center justify-center rounded-md text-text-secondary hover:bg-bg-muted md:hidden"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </Link>
        {contact ? (
          <>
            <UserAvatar username={contact.username} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium" data-testid="conversation-title">
                {contact.username}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-text-secondary" aria-live="polite">
                <PresenceDot online={contact.online} username={contact.username} />
                {isTyping ? 'Typing…' : contact.online ? 'Online' : 'Offline'}
                <span className="text-text-tertiary">· {ROLE_LABEL[contact.role]}</span>
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            {usersPending && (
              <>
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {disconnected && (
        <p role="status" className="shrink-0 border-b bg-bg-subtle px-4 py-2 text-center text-13 text-text-secondary">
          Reconnecting… New messages will arrive when you’re back online.
        </p>
      )}

      {notFound ? (
        <div className="flex-1 px-6">
          <EmptyState title="Conversation not found" description="This person doesn’t exist or was removed." />
        </div>
      ) : conversation.isPending ? (
        <ConversationSkeleton />
      ) : conversation.isError ? (
        <div className="flex-1 px-6">
          <ErrorState
            error={conversation.error}
            title="Could not load the conversation"
            onRetry={() => void conversation.refetch()}
          />
        </div>
      ) : (
        <MessageList
          messages={conversation.data}
          meId={me.id}
          otherName={contact?.username ?? '?'}
          onRetry={retry}
          onDiscard={discard}
          footer={isTyping && contact ? <TypingIndicator username={contact.username} /> : null}
          empty={
            <EmptyState
              className="py-16 sm:items-center sm:text-center"
              title="No messages yet"
              description={contact ? `Messages between you and ${contact.username} appear here.` : undefined}
            />
          }
        />
      )}

      {!notFound && (
        <Composer
          onSend={sendText}
          onTyping={typingEmitter.ping}
          onStopTyping={typingEmitter.stop}
          placeholder={contact ? `Message ${contact.username}` : 'Write a message…'}
        />
      )}
    </div>
  )
}

function ConversationSkeleton() {
  const rows = [
    { mine: false, w: 'w-48' },
    { mine: true, w: 'w-64' },
    { mine: true, w: 'w-40' },
    { mine: false, w: 'w-56' },
  ]
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-3 pt-4 sm:px-6" data-testid="loading-state" aria-busy="true">
      {rows.map((r, i) => (
        <div key={i} className={cn('flex', r.mine && 'justify-end')}>
          <Skeleton className={cn('h-9 max-w-[70%] rounded-lg', r.w)} />
        </div>
      ))}
    </div>
  )
}
