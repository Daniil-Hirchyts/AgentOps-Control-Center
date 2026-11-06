import { Link } from '@tanstack/react-router'
import { ArrowLeft, MessagesSquare } from 'lucide-react'
import { useEffect } from 'react'
import { ConnectionPill } from '@/components/shared/connection-pill'
import { RoleBadge, UserAvatar } from '@/components/shared/presence'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Id } from '@/lib/types'
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
  const setActive = useRealtimeStore((s) => s.setActiveConversation)

  useEffect(() => {
    setActive(userId)
    return () => setActive(null)
  }, [userId, setActive])

  if (!me) return null
  const notFound = !usersPending && !contact

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="conversation">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3 sm:px-5">
        <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
          <Link to="/messages" aria-label="Back to contacts">
            <ArrowLeft />
          </Link>
        </Button>
        {contact ? (
          <>
            <UserAvatar username={contact.username} online={contact.online} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold" data-testid="conversation-title">
                  {contact.username}
                </span>
                <RoleBadge role={contact.role} />
              </div>
              <p className="text-xs text-muted-foreground">
                {isTyping ? <span className="text-primary">typing…</span> : contact.online ? 'Online' : 'Offline'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1">{usersPending && <Skeleton className="h-5 w-32" />}</div>
        )}
        <ConnectionPill compact testId="conversation-ws-status" />
      </header>

      {notFound ? (
        <div className="p-6">
          <EmptyState title="User not found" description="This conversation does not exist." />
        </div>
      ) : conversation.isPending ? (
        <div className="flex-1 space-y-3 p-5" data-testid="loading-state">
          <Skeleton className="h-9 w-2/5" />
          <Skeleton className="ml-auto h-9 w-1/3" />
          <Skeleton className="h-14 w-1/2" />
          <Skeleton className="ml-auto h-9 w-1/4" />
        </div>
      ) : conversation.isError ? (
        <div className="flex-1 p-6">
          <ErrorState
            error={conversation.error}
            title="Could not load the conversation"
            onRetry={() => void conversation.refetch()}
          />
        </div>
      ) : conversation.data.length === 0 ? (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={MessagesSquare}
              title="No messages yet"
              description={contact ? `Say hello to ${contact.username} 👋` : undefined}
              className="border-0"
            />
          </div>
          {isTyping && contact && (
            <div className="px-5 pb-2">
              <TypingIndicator username={contact.username} />
            </div>
          )}
        </div>
      ) : (
        <MessageList
          messages={conversation.data}
          meId={me.id}
          onRetry={retry}
          onDiscard={discard}
          footer={isTyping && contact ? <TypingIndicator username={contact.username} /> : null}
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
