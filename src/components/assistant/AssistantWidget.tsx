import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { RotateCcw, Send, Square, X } from 'lucide-react'
import {
  ASSISTANT_MAX_QUESTION,
  ASSISTANT_NAME,
  useAssistantChat,
  useAssistantStatus,
  type AssistantMessage,
} from '@/hooks/useAssistantChat'
import '@/styles/assistant.css'
import { t, tMaybe } from '@/i18n'

const SUGGESTIONS = [
  'How much is the booking deposit?',
  'What happens if I lose my parking ticket?',
  'How do I top up my XXIV wallet?',
  'Can I book a motorbike bay?',
]

/**
 * Floating chat with Optimus Prime, the XXIV Parking assistant, for Guests and Users (homepage and customer
 * area). It answers from the XXIV Parking help only; hidden when the assistant is off or unreachable.
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
        <button type="button" className="ast-launcher" onClick={() => setIsOpen(true)} aria-label={t('Open {ASSISTANT_NAME}, the XXIV Parking assistant', { ASSISTANT_NAME })}>
          <Avatar className="ast-launcher__avatar" />
          <span className="ast-launcher__label">{t('Ask {ASSISTANT_NAME}', { ASSISTANT_NAME })}</span>
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
    <section className="ast-panel" role="dialog" aria-label={t('{ASSISTANT_NAME}, the XXIV Parking assistant', { ASSISTANT_NAME })}>
      <header className="ast-panel__head">
        <Avatar className="ast-panel__avatar" />
        <div className="ast-panel__title">
          <strong>{tMaybe(ASSISTANT_NAME)}</strong>
          <span>{searchOnly ? t('Help search mode') : t('Answers from the XXIV Parking help')}</span>
        </div>
        <button type="button" className="ast-icon" onClick={reset} disabled={messages.length === 0} aria-label={t('Start a new conversation')} title={t('New conversation')}>
          <RotateCcw size={16} />
        </button>
        <button type="button" className="ast-icon" onClick={onClose} aria-label={t('Close the assistant')} title={t('Close')}>
          <X size={18} />
        </button>
      </header>

      <div className="ast-panel__list" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="ast-welcome">
            <p>
              {t('Hi, I\'m {ASSISTANT_NAME}! Ask me about booking a bay, deposits, fees, paying, the wallet or vehicle verification.', { ASSISTANT_NAME })}
            </p>
            <div className="ast-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="ast-chip" onClick={() => submit(s)}>
                  {tMaybe(s)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={tMaybe(m)} isStreaming={isAnswering && m === messages[messages.length - 1]} />)
        )}
      </div>

      <form className="ast-panel__form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className="ast-input"
          rows={2}
          value={draft}
          maxLength={ASSISTANT_MAX_QUESTION}
          placeholder={t('Type your question...')}
          aria-label={t('Your question')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {isAnswering ? (
          <button type="button" className="ast-send" onClick={stop} aria-label={t('Stop the answer')} title={t('Stop')}>
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" className="ast-send" disabled={!draft.trim()} aria-label={t('Send')} title={t('Send')}>
            <Send size={16} />
          </button>
        )}
      </form>
      <p className="ast-panel__note">{t('Don\'t share passwords, ID or plate numbers. Answers may be imperfect; staff at the lot have the final say.')}</p>
    </section>
  )
}

function MessageBubble({ message, isStreaming }: { message: AssistantMessage; isStreaming: boolean }) {
  const isUser = message.role === 'user'
  const sources = message.sources ?? []

  return (
    <div className={`ast-msg ${isUser ? 'ast-msg--user' : 'ast-msg--bot'}`}>
      {!isUser && <Avatar className="ast-msg__avatar" />}
      <div className="ast-msg__bubble">
        {isUser ? (
          tMaybe(message.content)
        ) : message.content ? (
          <FormattedText text={tMaybe(message.content)} />
        ) : isStreaming ? (
          <span className="ast-typing" aria-label={t('{ASSISTANT_NAME} is typing', { ASSISTANT_NAME })}>
            <i />
            <i />
            <i />
          </span>
        ) : null}
        {message.error && <p className="ast-msg__error">{tMaybe(message.error)}</p>}
      </div>
      {!isUser && sources.length > 0 && !isStreaming && (
        <p className="ast-msg__sources">{t('From the help:')}{' '}{[...new Set(sources.map((s) => s.heading))].join(' · ')}</p>
      )}
    </div>
  )
}

const AVATAR_SRC = '/virgo-avatar.jpg'

/** Optimus Prime's avatar: a round robot portrait (decorative; the name is announced elsewhere). */
function Avatar({ className }: { className: string }) {
  return (
    <span className={`ast-avatar ${className}`} aria-hidden="true">
      <img src={AVATAR_SRC} alt="" />
    </span>
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
  return <>{tMaybe(blocks)}</>
}

function bold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}
