import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RealtimeContext } from '@/lib/realtime-context'
import { handleServerEvent } from '@/lib/realtime-handlers'
import type { MessageDto } from '@/lib/types'
import type { ClientFrame } from '@/lib/ws-events'
import { makeUser, mockFetch, renderWithProviders, signIn } from '@/test/utils'
import { useRealtimeStore } from '@/stores/realtime'
import { ConversationView } from './conversation-view'

const alice = makeUser({ id: 1, username: 'alice', role: 'OPERATOR' })
const bob = makeUser({ id: 2, username: 'bob', role: 'REVIEWER', online: true })

const history: MessageDto[] = [
  { id: 10, expediteurId: 2, destinataireId: 1, contenu: 'Hi Alice', dateEnvoi: '2026-09-20T09:00:00Z' },
  { id: 11, expediteurId: 1, destinataireId: 2, contenu: 'Hello Bob', dateEnvoi: '2026-09-20T09:01:00Z' },
  { id: 12, expediteurId: 2, destinataireId: 1, contenu: 'Run #7 looks odd', dateEnvoi: '2026-09-21T10:15:30Z' },
]

function setup(send: (f: ClientFrame) => boolean = () => true) {
  signIn(alice)
  mockFetch([
    { path: '/api/utilisateurs', handler: () => ({ body: [alice, bob] }) },
    { path: '/api/messages/2', handler: () => ({ body: history }) },
  ])
  const sendMock = vi.fn(send)
  const utils = renderWithProviders(
    <RealtimeContext.Provider value={{ send: sendMock }}>
      <ConversationView userId={2} />
    </RealtimeContext.Provider>,
    { path: '/messages/2' },
  )
  return { ...utils, sendMock }
}

describe('Conversation', () => {
  it('renders REST history with day separators and ownership', async () => {
    setup()
    const bubbles = await screen.findAllByTestId('message-bubble')
    expect(bubbles.map((b) => b.textContent)).toEqual(['Hi Alice', 'Hello Bob', 'Run #7 looks odd'])
    expect(bubbles.map((b) => b.dataset.mine)).toEqual(['false', 'true', 'false'])
    expect(screen.getAllByTestId('day-separator')).toHaveLength(2)
    expect(screen.getByTestId('conversation-title')).toHaveTextContent('bob')
    expect(screen.getByTestId('presence-bob')).toHaveAttribute('data-online', 'true')
    expect(useRealtimeStore.getState().activeConversation).toBe(2)
  })

  it('sends over WS with Enter, shows an optimistic bubble, then reconciles the echo', async () => {
    const { sendMock, qc } = setup()
    await screen.findAllByTestId('message-bubble')

    const input = screen.getByTestId('message-input')
    await userEvent.type(input, 'On it!{Enter}')

    const frame = sendMock.mock.calls.map(([f]) => f).find((f) => f.type === 'message')
    expect(frame).toMatchObject({
      type: 'message',
      destinataireId: 2,
      contenu: 'On it!',
      expediteurId: 1,
    })
    expect(frame && 'clientMessageId' in frame && frame.clientMessageId).toBeTruthy()
    expect(frame && 'dateEnvoi' in frame && frame.dateEnvoi).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    expect(input).toHaveValue('')

    const optimistic = screen.getAllByTestId('message-bubble').at(-1)!
    expect(optimistic).toHaveTextContent('On it!')
    expect(optimistic).toHaveAttribute('data-delivery', 'sending')

    // server echo with authoritative id
    act(() => {
      handleServerEvent(
        {
          type: 'message',
          id: 99,
          expediteurId: 1,
          destinataireId: 2,
          contenu: 'On it!',
          dateEnvoi: '2026-09-21T10:16:00Z',
          clientMessageId: frame!.type === 'message' ? frame!.clientMessageId : '',
        },
        { qc, me: alice, navigate: vi.fn() },
      )
    })
    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(4)
      expect(bubbles.at(-1)).toHaveAttribute('data-delivery', 'sent')
      expect(bubbles.at(-1)).toHaveAttribute('data-message-id', '99')
    })

    // duplicate delivery is ignored
    act(() => {
      handleServerEvent(
        { type: 'message', id: 99, expediteurId: 1, destinataireId: 2, contenu: 'On it!', dateEnvoi: '2026-09-21T10:16:00Z' },
        { qc, me: alice, navigate: vi.fn() },
      )
    })
    expect(screen.getAllByTestId('message-bubble')).toHaveLength(4)
  })

  it('Shift+Enter inserts a newline instead of sending', async () => {
    const { sendMock } = setup()
    await screen.findAllByTestId('message-bubble')
    await userEvent.type(screen.getByTestId('message-input'), 'line1{Shift>}{Enter}{/Shift}line2')
    expect(screen.getByTestId('message-input')).toHaveValue('line1\nline2')
    expect(sendMock.mock.calls.filter(([f]) => f.type === 'message')).toHaveLength(0)
  })

  it('marks the message failed when the socket is down, and on a WS error event', async () => {
    const { qc } = setup(() => false)
    await screen.findAllByTestId('message-bubble')
    await userEvent.type(screen.getByTestId('message-input'), 'offline msg{Enter}')
    const last = screen.getAllByTestId('message-bubble').at(-1)!
    expect(last).toHaveAttribute('data-delivery', 'failed')
    expect(screen.getByTestId('message-failed')).toHaveTextContent('Not connected')
    expect(within(screen.getByTestId('message-failed')).getByText('Retry')).toBeInTheDocument()

    // error event targeting an in-flight message
    const cached = qc.getQueryData<{ clientMessageId?: string }[]>(['messages', 2])!
    const cid = cached.at(-1)!.clientMessageId!
    act(() => {
      handleServerEvent(
        { type: 'error', code: 'rate_limited', message: 'Too many messages', clientMessageId: cid },
        { qc, me: alice, navigate: vi.fn() },
      )
    })
    await waitFor(() => expect(screen.getByTestId('message-failed')).toHaveTextContent('Too many messages'))
  })

  it('disables send for blank input and enforces the 4000 char limit', async () => {
    setup()
    await screen.findAllByTestId('message-bubble')
    const send = screen.getByTestId('send-button')
    expect(send).toBeDisabled()
    await userEvent.type(screen.getByTestId('message-input'), '   ')
    expect(send).toBeDisabled()
    await userEvent.clear(screen.getByTestId('message-input'))
    await userEvent.click(screen.getByTestId('message-input'))
    await userEvent.paste('x'.repeat(4001))
    expect(send).toBeDisabled()
    expect(screen.getByTestId('char-counter')).toHaveTextContent('4001/4000')
  })

  it('shows the typing indicator from a typing event', async () => {
    const { qc } = setup()
    await screen.findAllByTestId('message-bubble')
    act(() => {
      handleServerEvent(
        { type: 'typing', expediteurId: 2, destinataireId: 1, isTyping: true },
        { qc, me: alice, navigate: vi.fn() },
      )
    })
    expect(await screen.findByTestId('typing-indicator')).toHaveTextContent('bob is typing…')
    act(() => {
      handleServerEvent(
        { type: 'typing', expediteurId: 2, destinataireId: 1, isTyping: false },
        { qc, me: alice, navigate: vi.fn() },
      )
    })
    await waitFor(() => expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument())
  })
})
