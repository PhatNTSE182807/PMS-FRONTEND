import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '@/api/apiError'
import { assistantService } from '@/api/assistant.service'
import { queryKeys } from '@/api/queryKeys'
import type { AssistantMode, AssistantSourceDTO } from '@/types/assistant.dto'

/** Longest question the backend accepts. */
export const ASSISTANT_MAX_QUESTION = 500

/** Earlier messages sent with a question; the backend keeps the last 6 anyway. */
const HISTORY_SENT = 6

const STORAGE_KEY = 'xxiv_assistant_chat'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantSourceDTO[]
  mode?: AssistantMode
  /** Set when the answer failed or was cut off. */
  error?: string
}

/** Whether the chat button is shown: hidden when the assistant is off or the API cannot be reached. */
export function useAssistantStatus() {
  return useQuery({
    queryKey: queryKeys.assistant.status(),
    queryFn: assistantService.status,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

function loadMessages(): AssistantMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AssistantMessage[]) : []
  } catch {
    return []
  }
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Conversation with the assistant. The conversation lives in the browser tab (sessionStorage), so it
 * survives moving between pages but not closing the tab; nothing is saved on the server.
 */
export function useAssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>(loadMessages)
  const [isAnswering, setIsAnswering] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Storage unavailable (private mode): the chat still works for this page
    }
  }, [messages])

  // Stop a running answer when the widget unmounts
  useEffect(() => () => abortRef.current?.abort(), [])

  const updateAnswer = useCallback((id: string, change: (message: AssistantMessage) => AssistantMessage) => {
    setMessages((current) => current.map((m) => (m.id === id ? change(m) : m)))
  }, [])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim().slice(0, ASSISTANT_MAX_QUESTION)
      if (!question || isAnswering) return

      const history = messages
        .filter((m) => !m.error && m.content)
        .slice(-HISTORY_SENT)
        .map((m) => ({ role: m.role, content: m.content }))
      const answerId = newId()
      setMessages((current) => [
        ...current,
        { id: newId(), role: 'user', content: question },
        { id: answerId, role: 'assistant', content: '' },
      ])
      setIsAnswering(true)

      const controller = new AbortController()
      abortRef.current = controller
      try {
        await assistantService.chat(
          { messages: [...history, { role: 'user', content: question }] },
          (event) => {
            if (event.type === 'sources') updateAnswer(answerId, (m) => ({ ...m, sources: event.sources, mode: event.mode }))
            else if (event.type === 'delta') updateAnswer(answerId, (m) => ({ ...m, content: m.content + event.text }))
            else if (event.type === 'error') updateAnswer(answerId, (m) => ({ ...m, error: event.message }))
          },
          controller.signal,
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          updateAnswer(answerId, (m) => ({ ...m, error: getErrorMessage(error, 'The assistant could not answer right now.') }))
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setIsAnswering(false)
      }
    },
    [isAnswering, messages, updateAnswer],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
  }, [])

  return { messages, isAnswering, send, stop, reset }
}
