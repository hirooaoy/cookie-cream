import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'
import type { ServerConfig } from './config.js'
import type { TranslationRequest, TranslationResponse } from '../src/translationApi.js'

type NovaTranslationDecision = {
  translation: string
}

let cachedClient: BedrockRuntimeClient | null = null
let cachedRegion: string | null = null

export async function resolveNovaTranslationRequest(
  request: TranslationRequest,
  config: ServerConfig['nova'],
): Promise<TranslationResponse> {
  const translation = await requestTranslation(request, config)

  return {
    translation,
    meta: {
      source: 'nova',
      modelId: config.textModelId,
    },
  }
}

function getClient(region: string): BedrockRuntimeClient {
  if (!cachedClient || cachedRegion !== region) {
    cachedClient = new BedrockRuntimeClient({ region })
    cachedRegion = region
  }

  return cachedClient
}

async function requestTranslation(
  request: TranslationRequest,
  config: ServerConfig['nova'],
): Promise<string> {
  const input: ConverseCommandInput = {
    modelId: config.textModelId,
    system: [{ text: buildSystemPrompt(request) }],
    messages: [
      {
        role: 'user',
        content: [{ text: request.text.trim() }],
      },
    ],
    inferenceConfig: {
      maxTokens: 180,
      temperature: 0,
      topP: 0.1,
    },
  }

  console.info('Nova translation request:', {
    modelId: config.textModelId,
    speaker: request.speaker,
    learnerLanguage: request.learnerLanguage,
    targetLanguage: request.targetLanguage,
    text: request.text.trim(),
  })

  const response = await getClient(config.region).send(new ConverseCommand(input))
  const rawResponseText = extractConverseText(response)

  return parseTranslation(rawResponseText)
}

function buildSystemPrompt(request: TranslationRequest): string {
  return [
    'You translate Cookie & Cream agent messages for the learner.',
    `The learner language is ${request.learnerLanguage}.`,
    `The target practice language is ${request.targetLanguage}.`,
    `The message speaker is ${request.speaker}.`,
    'Translate the full message into natural, concise English.',
    'If the message already contains English plus a quoted target-language example, translate that example too so the full result reads naturally in English.',
    'Keep the original tone and sentence count when possible.',
    'Do not add explanations, notes, or labels.',
    'Return strict JSON only.',
    'Do not output markdown.',
    'Do not output code fences.',
    'Return exactly {"translation":"..."}',
  ].join('\n')
}

function extractConverseText(response: ConverseCommandOutput): string {
  const text = response.output?.message?.content
    ?.map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .join('')
    .trim()

  if (!text) {
    throw new Error('Nova translation returned an empty response.')
  }

  return text
}

function parseTranslation(rawResponseText: string): string {
  const candidate = extractJsonObject(rawResponseText)
  const parsed = JSON.parse(candidate) as Partial<NovaTranslationDecision>

  if (typeof parsed.translation !== 'string') {
    throw new Error('Nova translation returned an invalid payload.')
  }

  const translation = parsed.translation.trim()

  if (!translation) {
    throw new Error('Nova translation returned an empty translation.')
  }

  return translation
}

function extractJsonObject(rawResponseText: string): string {
  const cleaned = rawResponseText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
  const startIndex = cleaned.indexOf('{')
  const endIndex = cleaned.lastIndexOf('}')

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Nova translation response did not include JSON.')
  }

  return cleaned.slice(startIndex, endIndex + 1)
}

export const __testables = {
  buildSystemPrompt,
  extractConverseText,
  parseTranslation,
}
