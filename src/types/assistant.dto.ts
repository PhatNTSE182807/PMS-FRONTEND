/** Contracts of the customer chat assistant (backend AssistantController, `/api/public/assistant`). */

export type AssistantRole = 'user' | 'assistant'

export interface AssistantChatMessageDTO {
  role: AssistantRole
  content: string
}

export interface AssistantChatRequestDTO {
  messages: AssistantChatMessageDTO[]
}

/** "Model" when a language model writes the answers, "SearchOnly" when help sections are returned as they are. */
export type AssistantMode = 'Model' | 'SearchOnly'

export interface AssistantStatusDTO {
  enabled: boolean
  mode: AssistantMode
  /** Number of help sections loaded. */
  sections: number
  /** True when sections are searched by meaning (embeddings), false when by keywords. */
  semanticSearch: boolean
}

/** A help section the answer is based on. */
export interface AssistantSourceDTO {
  file: string
  heading: string
  title: string
  score: number
}

/** Server-Sent Events of `POST /public/assistant/chat`, in order: sources, deltas, then done or error. */
export type AssistantStreamEvent =
  | { type: 'sources'; mode: AssistantMode; sources: AssistantSourceDTO[] }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
