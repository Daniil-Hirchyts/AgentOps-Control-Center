import { EmptyState } from '@/components/shared/states'
import { useDocumentTitle } from '@/lib/hooks'
import type { Id } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ContactList } from './contact-list'
import { ConversationView } from './conversation-view'

/** Two panes on desktop; on phones the contact list and the conversation are separate views. */
export function MessagesPage({ selectedUserId }: { selectedUserId?: Id }) {
  const hasSelection = selectedUserId !== undefined
  return (
    <div className="flex h-full min-h-0" data-testid="messages-page">
      <aside
        className={cn(
          'min-h-0 w-full flex-col md:flex md:w-72 md:shrink-0 md:border-r',
          hasSelection ? 'hidden' : 'flex',
        )}
        aria-label="Conversations"
      >
        <ContactList selectedUserId={selectedUserId} />
      </aside>
      <section className={cn('min-h-0 min-w-0 flex-1 flex-col', hasSelection ? 'flex' : 'hidden md:flex')}>
        {hasSelection ? <ConversationView key={selectedUserId} userId={selectedUserId} /> : <NoSelection />}
      </section>
    </div>
  )
}

function NoSelection() {
  useDocumentTitle('Messages')
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState title="No conversation selected" description="Choose someone on the left. Messages arrive in real time." />
    </div>
  )
}
