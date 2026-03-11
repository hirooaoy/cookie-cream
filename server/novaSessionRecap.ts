import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'
import type { ServerConfig } from './config.js'
import type { SessionRecap, SessionRecapRequest, SessionRecapResponse } from '../src/recapApi.js'

let cachedClient: BedrockRuntimeClient | null = null
let cachedRegion: string | null = null

export async function resolveNovaSessionRecap(
  request: SessionRecapRequest,
  config: ServerConfig['nova'],
): Promise<SessionRecapResponse> {
  const recap = await generateRecap(request, config)

  return {
    recap,
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

async function generateRecap(
  request: SessionRecapRequest,
  config: ServerConfig['nova'],
): Promise<SessionRecap> {
  const initialRecap = await requestRecap(buildSystemPrompt(request), request, config)
  const validation = validateRecap(initialRecap)

  if (!validation) {
    return initialRecap
  }

  return requestRecap(buildRepairPrompt(validation), request, config)
}

async function requestRecap(
  systemPrompt: string,
  request: SessionRecapRequest,
  config: ServerConfig['nova'],
): Promise<SessionRecap> {
  const input: ConverseCommandInput = {
    modelId: config.textModelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: formatRecentMessages(request.recentMessages) }],
      },
    ],
    inferenceConfig: {
      maxTokens: 220,
      temperature: 0,
      topP: 0.1,
    },
  }

  logRecapRequest(config.textModelId)

  try {
    const response = await getClient(config.region).send(new ConverseCommand(input))
    return parseRecapPayload(extractConverseText(response))
  } catch (error) {
    logRecapError(error)
    throw error
  }
}

function buildSystemPrompt(request: SessionRecapRequest): string {
  return [
    'You create a short session recap for Cookie & Cream.',
    'The learner speaks English and is practicing Spanish.',
    'Use only the recent in-session messages provided.',
    'Write the recap in English.',
    'Keep it short, useful, and encouraging.',
    'Return strict JSON only.',
    'Do not output markdown, code fences, or extra prose.',
    'Return exactly this shape:',
    '{"didWell":["...","...","..."],"betterWay":"...","tryNext":"..."}',
    'didWell must contain exactly 3 short concrete positives.',
    'betterWay must contain exactly 1 better way to say something, ideally with one Spanish phrase in quotes when useful.',
    'tryNext must contain exactly 1 short next-step suggestion.',
    `Learner language: ${request.learnerLanguage}.`,
    `Target language: ${request.targetLanguage}.`,
    'Recent messages follow in the user message.',
  ].join('\n')
}

function buildRepairPrompt(reason: string): string {
  return [
    'Repair the session recap output.',
    'Return strict JSON only.',
    'Do not output markdown, code fences, or extra prose.',
    'Return exactly this shape:',
    '{"didWell":["...","...","..."],"betterWay":"...","tryNext":"..."}',
    `Repair reason: ${reason}.`,
  ].join('\n')
}

function formatRecentMessages(messages: SessionRecapRequest['recentMessages']): string {
  if (messages.length === 0) {
    return '(none)'
  }

  return messages.slice(-10).map((message) => `${message.speaker}: ${message.text}`).join('\n')
}

function extractConverseText(response: ConverseCommandOutput): string {
  const text = response.output?.message?.content
    ?.map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .join('')
    .trim()

  if (!text) {
    throw new Error('Nova recap path returned an empty response.')
  }

  return text
}

function parseRecapPayload(rawResponseText: string): SessionRecap {
  const parsed = JSON.parse(extractJsonObject(rawResponseText)) as Partial<SessionRecap>
  const didWell = Array.isArray(parsed.didWell)
    ? parsed.didWell.map((item) => (typeof item === 'string' ? normalizeWhitespace(item) : ''))
    : []
  const betterWay = typeof parsed.betterWay === 'string' ? normalizeWhitespace(parsed.betterWay) : ''
  const tryNext = typeof parsed.tryNext === 'string' ? normalizeWhitespace(parsed.tryNext) : ''

  if (didWell.length !== 3 || didWell.some((item) => !item) || !betterWay || !tryNext) {
    throw new Error('Nova recap path returned an invalid recap payload.')
  }

  return {
    didWell: [didWell[0], didWell[1], didWell[2]],
    betterWay,
    tryNext,
  }
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
    throw new Error('Nova recap response did not include JSON.')
  }

  return cleaned.slice(startIndex, endIndex + 1)
}

function validateRecap(recap: SessionRecap): string | null {
  if (recap.didWell.length !== 3 || recap.didWell.some((item) => !item)) {
    return 'didWell must contain exactly three non-empty items.'
  }

  if (recap.didWell.some((item) => item.split(/\s+/).length > 12)) {
    return 'didWell items must stay short.'
  }

  if (!recap.betterWay) {
    return 'betterWay must be present.'
  }

  if (!recap.tryNext) {
    return 'tryNext must be present.'
  }

  return null
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function logRecapRequest(modelId: string): void {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  console.info('[nova-recap] request:', { modelId })
}

function logRecapError(error: unknown): void {
  const candidate = error as {
    $metadata?: Record<string, unknown>
    message?: string
    name?: string
  }

  console.error('[nova-recap] request failed:', {
    name: candidate?.name ?? 'Error',
    message: candidate?.message ?? String(error),
    metadata: candidate?.$metadata,
  })
}

export const __testables = {
  buildSystemPrompt,
  parseRecapPayload,
  validateRecap,
}
