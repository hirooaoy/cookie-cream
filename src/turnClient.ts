import type { ConversationState, Message, Phase } from './prototype.js'
import {
  resolveLocalTurnRequest,
  type TurnMeta,
  type TurnRequest,
  type TurnResponse,
} from './turnApi.js'

const turnEndpoint = '/api/turn'
const learnerLanguage = 'English'
const targetLanguage = 'Spanish'

export type TurnSubmissionResult = {
  conversation: ConversationState
  meta: TurnMeta
  delivery: 'backend' | 'client-fallback'
}

export async function submitTurnWithFallback(
  conversation: ConversationState,
  transcript: string,
): Promise<TurnSubmissionResult> {
  const request = buildTurnRequest(conversation, transcript)

  try {
    const response = await submitTurnRequest(request)
    return createTurnSubmissionResult(conversation, response, 'backend')
  } catch (error) {
    console.warn('Backend turn submission failed. Falling back to local turn engine.', error)

    const fallbackResponse = resolveLocalTurnRequest(request)

    return createTurnSubmissionResult(conversation, fallbackResponse, 'client-fallback')
  }
}

function buildTurnRequest(conversation: ConversationState, transcript: string): TurnRequest {
  return {
    transcript,
    phase: conversation.phase,
    recentMessages: conversation.messages,
    learnerLanguage,
    targetLanguage,
  }
}

async function submitTurnRequest(request: TurnRequest): Promise<TurnResponse> {
  const response = await fetch(turnEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Turn request failed with status ${response.status}.`)
  }

  const payload: unknown = await response.json()

  if (!isTurnResponse(payload)) {
    throw new Error('Turn request returned an invalid response shape.')
  }

  return payload
}

function applyTurnResponse(
  conversation: ConversationState,
  response: TurnResponse,
): ConversationState {
  return {
    messages: [...conversation.messages, ...response.messages],
    phase: response.nextPhase,
  }
}

function createTurnSubmissionResult(
  conversation: ConversationState,
  response: TurnResponse,
  delivery: TurnSubmissionResult['delivery'],
): TurnSubmissionResult {
  return {
    conversation: applyTurnResponse(conversation, response),
    meta: response.meta,
    delivery,
  }
}

function isTurnResponse(value: unknown): value is TurnResponse {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.messages) &&
    value.messages.every(isMessage) &&
    isPhase(value.nextPhase) &&
    isTurnMeta(value.meta)
  )
}

function isTurnMeta(value: unknown): value is TurnMeta {
  if (!isRecord(value)) {
    return false
  }

  return (
    isRoute(value.route) &&
    isSource(value.source) &&
    (value.modelId === undefined || typeof value.modelId === 'string')
  )
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isSpeaker(value.speaker) &&
    typeof value.text === 'string' &&
    (value.target === undefined || isRoute(value.target))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPhase(value: unknown): value is Phase {
  return value === 'normal' || value === 'retry-after-cookie'
}

function isSpeaker(value: unknown): value is Message['speaker'] {
  return value === 'Cream' || value === 'Cookie' || value === 'User'
}

function isRoute(value: unknown): value is TurnMeta['route'] {
  return value === 'Cream' || value === 'Cookie' || value === 'none'
}

function isSource(value: unknown): value is TurnMeta['source'] {
  return value === 'nova' || value === 'local-fallback'
}
