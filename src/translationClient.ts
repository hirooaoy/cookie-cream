import type { Message } from './prototype.js'
import {
  resolveLocalTranslation,
  type AgentSpeaker,
  type TranslationMeta,
  type TranslationRequest,
  type TranslationResponse,
} from './translationApi.js'

const translationEndpoint = '/api/translate'
const learnerLanguage = 'English'
const targetLanguage = 'Spanish'

export type TranslationResult = {
  translation: string
  meta: TranslationMeta
  delivery: 'backend' | 'client-fallback'
}

export async function translateMessageWithFallback(message: Message): Promise<TranslationResult> {
  if (message.speaker === 'User') {
    throw new Error('Translation is only available for agent messages.')
  }

  const request = buildTranslationRequest(message)

  try {
    const response = await submitTranslationRequest(request)

    return {
      translation: response.translation,
      meta: response.meta,
      delivery: 'backend',
    }
  } catch (error) {
    console.warn('Backend translation request failed. Falling back to local translator.', error)

    const fallbackResponse = resolveLocalTranslation(request)

    return {
      translation: fallbackResponse.translation,
      meta: fallbackResponse.meta,
      delivery: 'client-fallback',
    }
  }
}

function buildTranslationRequest(message: Message): TranslationRequest {
  return {
    text: message.text,
    speaker: message.speaker as AgentSpeaker,
    learnerLanguage,
    targetLanguage,
  }
}

async function submitTranslationRequest(request: TranslationRequest): Promise<TranslationResponse> {
  const response = await fetch(translationEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}.`)
  }

  const payload: unknown = await response.json()

  if (!isTranslationResponse(payload)) {
    throw new Error('Translation request returned an invalid response shape.')
  }

  return payload
}

function isTranslationResponse(value: unknown): value is TranslationResponse {
  if (!isRecord(value) || !isRecord(value.meta)) {
    return false
  }

  return (
    typeof value.translation === 'string' &&
    isTranslationSource(value.meta.source) &&
    (value.meta.modelId === undefined || typeof value.meta.modelId === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTranslationSource(value: unknown): value is TranslationMeta['source'] {
  return value === 'nova' || value === 'local-fallback'
}
