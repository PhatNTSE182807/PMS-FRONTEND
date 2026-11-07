import { getApiBaseUrl, isMockService, SERVICE_PATHS } from '@/config/env'
import { delay, mockResponse } from '@/mocks/mockApi'
import type {
  AssistantChatRequestDTO,
  AssistantSourceDTO,
  AssistantStatusDTO,
  AssistantStreamEvent,
} from '@/types/assistant.dto'
import { ApiError } from './apiError'
import { http } from './axiosClient'

const MOCK_STATUS: AssistantStatusDTO = { enabled: true, mode: 'Model', sections: 0, semanticSearch: false }
const MOCK_ANSWER =
  'This is demo data: the assistant is not connected to the server in demo mode. ' +
  'Sign in against the real API to ask questions about bookings, deposits, fees and the wallet.'

/**
 * Customer chat assistant. Open to everyone (no sign-in): it answers from the XXIV Parking help
 * only and never reads account data. The chat streams Server-Sent Events, which axios cannot read
 * in the browser, so it uses fetch.
 */
export const assistantService = {
  /** GET /public/assistant/status: whether to show the chat button. */
  status(): Promise<AssistantStatusDTO> {
    if (isMockService('assistant')) return mockResponse(() => MOCK_STATUS)
    return http.get<AssistantStatusDTO>(`${SERVICE_PATHS.assistant}/status`)
  },

  /** POST /public/assistant/chat: calls `onEvent` for every event until the answer is done or `signal` aborts. */
  async chat(
    request: AssistantChatRequestDTO,
    onEvent: (event: AssistantStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    if (isMockService('assistant')) return mockChat(onEvent, signal)

    let response: Response
    try {
      response = await fetch(`${getApiBaseUrl()}${SERVICE_PATHS.assistant}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(request),
        signal,
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new ApiError(['The assistant is not reachable. Check your connection and try again.'], {
        isNetworkError: true,
      })
    }

    if (!response.ok || !response.body) throw await toError(response)
    await readEvents(response.body, onEvent, signal)
  },
}

/** Parses the "event: x" / "data: {json}" blocks of a Server-Sent Events stream. */
async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AssistantStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let end = buffer.indexOf('\n\n')
      while (end >= 0) {
        const block = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const event = parseBlock(block)
        if (event) onEvent(event)
        end = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseBlock(block: string): AssistantStreamEvent | null {
  let name = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  const payload = data ? (JSON.parse(data) as Record<string, unknown>) : {}
  switch (name) {
    case 'sources':
      return {
        type: 'sources',
        mode: payload.mode === 'SearchOnly' ? 'SearchOnly' : 'Model',
        sources: Array.isArray(payload.sources) ? (payload.sources as AssistantSourceDTO[]) : [],
      }
    case 'delta':
      return { type: 'delta', text: String(payload.text ?? '') }
    case 'error':
      return { type: 'error', message: String(payload.message ?? 'Something went wrong.') }
    case 'done':
      return { type: 'done' }
    default:
      return null
  }
}

/** A failed request still answers with the usual ApiResult envelope (400), or 429 from the rate limiter. */
async function toError(response: Response): Promise<ApiError> {
  if (response.status === 429) {
    return new ApiError(['You have asked a lot of questions in a short time. Wait a minute and try again.'], {
      status: 429,
    })
  }
  try {
    const body = (await response.json()) as { errors?: string[] }
    if (body.errors?.length) return new ApiError(body.errors, { status: response.status })
  } catch {
    // Not JSON: fall through to the generic message
  }
  return new ApiError(['The assistant could not answer right now. Please try again.'], { status: response.status })
}

async function mockChat(onEvent: (event: AssistantStreamEvent) => void, signal: AbortSignal): Promise<void> {
  onEvent({ type: 'sources', mode: 'Model', sources: [] })
  for (const word of MOCK_ANSWER.split(' ')) {
    if (signal.aborted) return
    await delay(40)
    onEvent({ type: 'delta', text: `${word} ` })
  }
  onEvent({ type: 'done' })
}
