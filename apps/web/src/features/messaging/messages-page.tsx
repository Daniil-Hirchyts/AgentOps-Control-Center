import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '@/components/shared/states'
import type { Id } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ContactList } from './contact-list'
import { ConversationView } from './conversation-view'

/** Two-pane on desktop; on mobile the list and the conversation are separate views. */
export function MessagesPage({ selectedUserId }: { selectedUserId?: Id }) {
  const hasSelection = selectedUserId !== undefined
  return (
    <div className="flex h-full min-h-0" data-testid="messages-page">
      <aside
        className={cn(
          'min-h-0 w-full flex-col border-r bg-card md:flex md:w-80 md:shrink-0',
          hasSelection ? 'hidden' : 'flex',
        )}
      >
        <ContactList selectedUserId={selectedUserId} />
      </aside>
      <section className={cn('min-h-0 min-w-0 flex-1 flex-col bg-background', hasSelection ? 'flex' : 'hidden md:flex')}>
        {hasSelection ? (
          <ConversationView key={selectedUserId} userId={selectedUserId} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={MessagesSquare}
              title="Select a conversation"
              description="Pick a contact on the left to start chatting. Messages are delivered in real time."
              className="border-0"
            />
          </div>
        )}
      </section>
    </div>
  )
}
