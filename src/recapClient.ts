import type { ConversationState, Message } from './prototype.js'
import {
  resolveLocalSessionRecap,
  type SessionRecap,
  type SessionRecapMeta,
  type SessionRecapRequest,
  type SessionRecapResponse,
} from './recapApi.js'

const recapEndpoint = '/api/recap'
const learnerLanguage = 'English'
const targetLanguage = 'Spanish'

export type SessionRecapResult = {
  recap: SessionRecap
  meta: SessionRecapMeta
  delivery: 'backend' | 'client-fallback'
}

export async function fetchSessionRecapWithFallback(
  conversation: ConversationState,
): Promise<SessionRecapResult> {
  const request = buildRecapRequest(conversation.messages)

  try {
    const response = await submitRecapRequest(request)

    return {
      recap: response.recap,
      meta: response.meta,
      delivery: 'backend',
    }
  } catch (error) {
    console.warn('Backend recap request failed. Falling back to local recap.', error)

    const fallbackResponse = resolveLocalSessionRecap(request)

    return {
      recap: fallbackResponse.recap,
      meta: fallbackResponse.meta,
      delivery: 'client-fallback',
    }
  }
}

function buildRecapRequest(recentMessages: Message[]): SessionRecapRequest {
  return {
    recentMessages,
    learnerLanguage,
    targetLanguage,
  }
}

async function submitRecapRequest(request: SessionRecapRequest): Promise<SessionRecapResponse> {
  const response = await fetch(recapEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Recap request failed with status ${response.status}.`)
  }

  const payload: unknown = await response.json()

  if (!isSessionRecapResponse(payload)) {
    throw new Error('Recap request returned an invalid response shape.')
  }

  return payload
}

function isSessionRecapResponse(value: unknown): value is SessionRecapResponse {
  if (!isRecord(value) || !isRecord(value.recap) || !isRecord(value.meta)) {
    return false
  }

  return (
    Array.isArray(value.recap.didWell) &&
    value.recap.didWell.length === 3 &&
    value.recap.didWell.every((item) => typeof item === 'string') &&
    typeof value.recap.betterWay === 'string' &&
    typeof value.recap.tryNext === 'string' &&
    isRecapSource(value.meta.source) &&
    (value.meta.modelId === undefined || typeof value.meta.modelId === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRecapSource(value: unknown): value is SessionRecapMeta['source'] {
  return value === 'nova' || value === 'local-fallback'
}
