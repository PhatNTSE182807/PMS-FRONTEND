import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Bot, MessageCircle, RotateCcw, Send, Square, X } from 'lucide-react'
import {
  ASSISTANT_MAX_QUESTION,
  useAssistantChat,
  useAssistantStatus,
  type AssistantMessage,
} from '@/hooks/useAssistantChat'
import '@/styles/assistant.css'

const SUGGESTIONS = [
  'How much is the booking deposit?',
  'What happens if I lose my parking ticket?',
  'How do I top up my XXIV wallet?',
  'Can I book a motorbike bay?',
]

/**
 * Floating chat with the XXIV Parking assistant, for Guests and Users (homepage and customer area).
 * It answers from the XXIV Parking help only; hidden when the assistant is off or unreachable.
 */
export function AssistantWidget() {
  const status = useAssistantStatus()
  const [isOpen, setIsOpen] = useState(false)

  if (!status.data?.enabled) return null

  return (
    <div className="ast">
      {isOpen ? (
        <AssistantPanel searchOnly={status.data.mode === 'SearchOnly'} onClose={() => setIsOpen(false)} />
      ) : (
        <button type="button" className="ast-launcher" onClick={() => setIsOpen(true)} aria-label="Open the XXIV assistant">
          <MessageCircle size={24} aria-hidden="true" />
          <span className="ast-launcher__label">Ask XXIV</span>
        </button>
      )}
    </div>
  )
}

function AssistantPanel({ searchOnly, onClose }: { searchOnly: boolean; onClose: () => void }) {
  const { messages, isAnswering, send, stop, reset } = useAssistantChat()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  // Follow the answer as it streams in
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const submit = (text: string) => {
    if (!text.trim() || isAnswering) return
    void send(text)
    setDraft('')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(draft)
  }

  // Enter sends, Shift+Enter starts a new line
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(draft)
    }
    if (event.key === 'Escape') onClose()
  }

  return (
    <section className="ast-panel" role="dialog" aria-label="XXIV Parking assistant">
      <header className="ast-panel__head">
        <span className="ast-panel__avatar" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div className="ast-panel__title">
          <strong>XXIV Assistant</strong>
          <span>{searchOnly ? 'Help search mode' : 'Answers from the XXIV Parking help'}</span>
        </div>
        <button type="button" className="ast-icon" onClick={reset} disabled={messages.length === 0} aria-label="Start a new conversation" title="New conversation">
          <RotateCcw size={16} />
        </button>
        <button type="button" className="ast-icon" onClick={onClose} aria-label="Close the assistant" title="Close">
          <X size={18} />
        </button>
      </header>

      <div className="ast-panel__list" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="ast-welcome">
            <p>Hi! Ask me about booking a bay, deposits, fees, paying, the wallet or vehicle verification.</p>
            <div className="ast-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="ast-chip" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} isStreaming={isAnswering && m === messages[messages.length - 1]} />)
        )}
      </div>

      <form className="ast-panel__form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className="ast-input"
          rows={2}
          value={draft}
          maxLength={ASSISTANT_MAX_QUESTION}
          placeholder="Type your question..."
          aria-label="Your question"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {isAnswering ? (
          <button type="button" className="ast-send" onClick={stop} aria-label="Stop the answer" title="Stop">
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" className="ast-send" disabled={!draft.trim()} aria-label="Send" title="Send">
            <Send size={16} />
          </button>
        )}
      </form>
      <p className="ast-panel__note">Don&apos;t share passwords, ID or plate numbers. Answers may be imperfect; staff at the lot have the final say.</p>
    </section>
  )
}

function MessageBubble({ message, isStreaming }: { message: AssistantMessage; isStreaming: boolean }) {
  const isUser = message.role === 'user'
  const sources = message.sources ?? []

  return (
    <div className={`ast-msg ${isUser ? 'ast-msg--user' : 'ast-msg--bot'}`}>
      <div className="ast-msg__bubble">
        {isUser ? (
          message.content
        ) : message.content ? (
          <FormattedText text={message.content} />
        ) : isStreaming ? (
          <span className="ast-typing" aria-label="The assistant is typing">
            <i />
            <i />
            <i />
          </span>
        ) : null}
        {message.error && <p className="ast-msg__error">{message.error}</p>}
      </div>
      {!isUser && sources.length > 0 && !isStreaming && (
        <p className="ast-msg__sources">From the help: {[...new Set(sources.map((s) => s.heading))].join(' · ')}</p>
      )}
    </div>
  )
}

/** Paragraphs, "- " lists and **bold**, rendered as React elements (never as raw HTML). */
function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flushList = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`}>{list.map((item, i) => <li key={i}>{bold(item)}</li>)}</ul>)
    list = []
  }

  for (const line of text.split('\n')) {
    const item = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line)
    if (item) {
      list.push(item[1])
      continue
    }
    flushList()
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{bold(line)}</p>)
  }
  flushList()
  return <>{blocks}</>
}

function bold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}
