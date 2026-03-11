import { randomUUID } from 'node:crypto'
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
  type InvokeModelWithBidirectionalStreamInput,
  type InvokeModelWithBidirectionalStreamOutput,
} from '@aws-sdk/client-bedrock-runtime'
import type { ServerConfig } from './config.js'
import { createAdaptiveCookieReply } from '../src/cookieCoach.js'
import { containsSpanish, type Message, type Phase, type UserTarget } from '../src/prototype.js'
import type { TurnRequest, TurnResponse } from '../src/turnApi.js'

type NovaDecision = {
  route: UserTarget
  reply: string
  betterSpanishPhrasing?: string
}

type NovaEventPayload = {
  event?: {
    contentStart?: {
      additionalModelFields?: string
      contentId?: string
      contentName?: string
      promptName?: string
      role?: string
      type?: string
    }
    contentEnd?: {
      type?: string
    }
    textOutput?: {
      content?: string
      role?: string
    }
  }
}

type SonicInputEvent = {
  event: Record<string, unknown>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const maxChunkSize = 900
const allowedProperNouns = ['McDonald', "McDonald's", 'YouTube', 'Uber', 'Netflix', 'Starbucks', 'Apple']
const obviousEnglishWords = new Set([
  'again',
  'cool',
  'did',
  'good',
  'hello',
  'hey',
  'hi',
  'hot',
  'how',
  'i',
  'nice',
  'okay',
  'ok',
  'please',
  'really',
  'say',
  'sorry',
  'test',
  'thanks',
  'thank',
  'today',
  'try',
  'very',
  'was',
  'what',
  'yeah',
  'yes',
])

let cachedClient: BedrockRuntimeClient | null = null
let cachedRegion: string | null = null

export async function resolveNovaTurnRequest(
  request: TurnRequest,
  config: ServerConfig['nova'],
): Promise<TurnResponse> {
  const decision = await generateTurnDecision(request, config)

  return createNovaTurnResponse(request, decision, config.sonicModelId)
}

function getClient(region: string): BedrockRuntimeClient {
  if (!cachedClient || cachedRegion !== region) {
    cachedClient = new BedrockRuntimeClient({ region })
    cachedRegion = region
  }

  return cachedClient
}

async function* buildNovaRequestStream(
  systemPrompt: string,
  reviewedTranscript: string,
  config: ServerConfig['nova'],
): AsyncIterable<InvokeModelWithBidirectionalStreamInput> {
  const promptName = `turn-${randomUUID()}`
  const systemContentName = `system-${randomUUID()}`
  const userContentName = `user-${randomUUID()}`
  const events = buildSonicEvents({
    promptName,
    systemContentName,
    userContentName,
    systemPrompt,
    reviewedTranscript,
    config,
  })

  logOutboundEvents(events)

  for (const event of events) {
    yield encodeEvent(event)
  }
}

async function collectAssistantText(
  body: AsyncIterable<InvokeModelWithBidirectionalStreamOutput> | undefined,
): Promise<string> {
  if (!body) {
    throw new Error('Nova response stream was empty.')
  }

  let activeRole = ''
  let generationStage = 'FINAL'
  let outputText = ''

  for await (const part of body) {
    if ('chunk' in part && part.chunk?.bytes) {
      const payload = parseNovaEventPayload(part.chunk.bytes)

      if (!payload?.event) {
        continue
      }

      if (payload.event.contentStart) {
        activeRole = payload.event.contentStart.role ?? ''
        generationStage = parseGenerationStage(payload.event.contentStart.additionalModelFields)
        continue
      }

      if (
        payload.event.textOutput?.content &&
        (payload.event.textOutput.role ?? activeRole) === 'ASSISTANT' &&
        generationStage !== 'SPECULATIVE'
      ) {
        outputText += payload.event.textOutput.content
      }

      continue
    }

    if ('internalServerException' in part && part.internalServerException) {
      throw new Error(part.internalServerException.message ?? 'Nova internal server error.')
    }

    if ('modelStreamErrorException' in part && part.modelStreamErrorException) {
      throw new Error(part.modelStreamErrorException.message ?? 'Nova stream error.')
    }

    if ('validationException' in part && part.validationException) {
      throw new Error(part.validationException.message ?? 'Nova validation error.')
    }

    if ('throttlingException' in part && part.throttlingException) {
      throw new Error(part.throttlingException.message ?? 'Nova throttling error.')
    }

    if ('modelTimeoutException' in part && part.modelTimeoutException) {
      throw new Error(part.modelTimeoutException.message ?? 'Nova timed out.')
    }

    if ('serviceUnavailableException' in part && part.serviceUnavailableException) {
      throw new Error(part.serviceUnavailableException.message ?? 'Nova service unavailable.')
    }
  }

  const normalized = outputText.trim()

  if (!normalized) {
    throw new Error('Nova did not return a text response.')
  }

  return normalized
}

function parseNovaDecision(rawResponseText: string): NovaDecision {
  const candidate = extractJsonObject(rawResponseText)
  const parsed = JSON.parse(candidate) as Partial<NovaDecision>

  if ((parsed.route !== 'Cookie' && parsed.route !== 'Cream') || typeof parsed.reply !== 'string') {
    throw new Error('Nova returned an invalid decision payload.')
  }

  const reply = parsed.reply.trim()

  if (!reply) {
    throw new Error('Nova returned an empty reply.')
  }

  return {
    route: parsed.route,
    reply,
    betterSpanishPhrasing:
      typeof parsed.betterSpanishPhrasing === 'string' ? parsed.betterSpanishPhrasing.trim() : undefined,
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
    throw new Error('Nova response did not include JSON.')
  }

  return cleaned.slice(startIndex, endIndex + 1)
}

function parseNovaEventPayload(bytes: Uint8Array): NovaEventPayload | null {
  const rawPayload = decoder.decode(bytes).trim()

  if (!rawPayload) {
    return null
  }

  try {
    return JSON.parse(rawPayload) as NovaEventPayload
  } catch {
    return null
  }
}

function createNovaTurnResponse(
  request: TurnRequest,
  decision: NovaDecision,
  modelId: string,
): TurnResponse {
  const normalizedDecision = normalizeNovaDecision(decision)
  const nextIndex = request.recentMessages.length + 1
  const userMessage: Message = {
    id: `user-${nextIndex}`,
    speaker: 'User',
    text: request.transcript.trim(),
    target: normalizedDecision.route,
  }
  const assistantMessage: Message = {
    id: `${normalizedDecision.route.toLowerCase()}-${nextIndex + 1}`,
    speaker: normalizedDecision.route,
    text: createAssistantReply(request, normalizedDecision),
  }

  return {
    messages: [userMessage, assistantMessage],
    nextPhase: getNextPhase(normalizedDecision.route),
    meta: {
      route: normalizedDecision.route,
      source: 'nova',
      modelId,
    },
  }
}

function getNextPhase(route: UserTarget): Phase {
  return route === 'Cookie' ? 'retry-after-cookie' : 'normal'
}

function encodeEvent(eventPayload: SonicInputEvent): InvokeModelWithBidirectionalStreamInput {
  return {
    chunk: {
      bytes: encoder.encode(JSON.stringify(eventPayload)),
    },
  }
}

function chunkText(text: string): string[] {
  const chunks: string[] = []

  for (let index = 0; index < text.length; index += maxChunkSize) {
    chunks.push(text.slice(index, index + maxChunkSize))
  }

  return chunks
}

function buildSystemPrompt(request: TurnRequest): string {
  return [
    'You are the core turn router for Cookie & Cream.',
    'Cookie is a warm English tutor for English-speaking intermediate Spanish learners.',
    'Cream is a casual Spanish conversation partner.',
    'Route Cookie if the learner uses any English beyond allowed proper nouns.',
    'Single English words still count as English, including hi, hello, test, thanks, and okay.',
    'When phase is retry-after-cookie, only route back to Cream if the learner now stays in Spanish.',
    'Cookie must be brief, warm, encouraging, explain one better Spanish phrasing, and never continue the topic.',
    'Cookie should adapt its wording to the mistake type instead of repeating one fixed script.',
    'If the learner stayed fully in English, Cookie should say that clearly and then give the Spanish version.',
    'If the learner mixed Spanish and English, Cookie should say they are close, point out the English part, and give the Spanish version.',
    'Cream must continue the conversation naturally in casual Spanish, never teach grammar, and never sound like Cookie.',
    'Allowed proper nouns: McDonald\'s, YouTube, Uber, Netflix, Starbucks, Apple.',
    'Examples:',
    '{"route":"Cookie","betterSpanishPhrasing":"Hoy hizo mucho calor.","reply":"That was all English. In Spanish, say: \\"Hoy hizo mucho calor.\\" Try again."} for transcript "Today was very hot".',
    '{"route":"Cookie","betterSpanishPhrasing":"Hoy hizo mucho calor.","reply":"You\'re close. \\"very hot\\" should be Spanish here. Say: \\"Hoy hizo mucho calor.\\""} for transcript "Hoy fue very hot".',
    '{"route":"Cookie","betterSpanishPhrasing":"Hola.","reply":"That was all English. In Spanish, say: \\"Hola.\\" Try again."} for transcript "hi".',
    '{"route":"Cream","reply":"Ah, sí. ¿Qué hiciste después?"} for transcript "Hoy hizo mucho calor." after Cookie.',
    `Current phase: ${request.phase}.`,
    `Learner language: ${request.learnerLanguage}.`,
    `Target language: ${request.targetLanguage}.`,
    'Recent messages:',
    formatRecentMessages(request.recentMessages),
    'The next USER text input is the reviewed learner transcript for this turn.',
    'Return strict JSON only.',
    'If route is Cookie, respond with {"route":"Cookie","betterSpanishPhrasing":"...","reply":"brief English coaching that asks for a retry"}',
    'If route is Cream, respond with {"route":"Cream","reply":"casual Spanish continuation"}',
  ].join('\n')
}

function formatRecentMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return '(none)'
  }

  const recentMessages = messages.slice(-8)

  return recentMessages.map((message) => `${message.speaker}: ${message.text}`).join('\n')
}

function normalizeNovaDecision(decision: NovaDecision): NovaDecision {
  const inferredBetterSpanishPhrasing =
    decision.betterSpanishPhrasing ?? extractQuotedPhrasing(decision.reply)

  return {
    route: decision.route,
    reply: normalizeWhitespace(decision.reply),
    betterSpanishPhrasing: inferredBetterSpanishPhrasing
      ? normalizeWhitespace(stripWrappingQuotes(inferredBetterSpanishPhrasing))
      : undefined,
  }
}

function createAssistantReply(request: TurnRequest, decision: NovaDecision): string {
  if (decision.route === 'Cookie') {
    return createCookieReply(request, decision)
  }

  return createCreamReply(request, decision.reply)
}

function createCookieReply(request: TurnRequest, decision: NovaDecision): string {
  return createAdaptiveCookieReply({
    transcript: request.transcript,
    betterSpanishPhrasing: decision.betterSpanishPhrasing,
    fallbackReply: normalizeWhitespace(stripCookieLeadIn(decision.reply)),
  })
}

function createCreamReply(request: TurnRequest, reply: string): string {
  const normalizedReply = normalizeWhitespace(reply)

  if (!normalizedReply) {
    throw new Error('Nova Cream reply was empty after normalization.')
  }

  if (looksLikeCookieReply(normalizedReply)) {
    throw new Error('Nova Cream reply drifted into Cookie coaching style.')
  }

  if (!containsSpanish(normalizedReply) && !looksLikeSpanishConversationReply(normalizedReply)) {
    throw new Error('Nova Cream reply did not look like natural Spanish conversation.')
  }

  if (request.phase === 'retry-after-cookie' && containsDisallowedEnglish(request.transcript)) {
    throw new Error('Nova tried to return Cream while the learner retry still contained English.')
  }

  return normalizedReply
}

async function generateTurnDecision(
  request: TurnRequest,
  config: ServerConfig['nova'],
): Promise<NovaDecision> {
  const initialDecision = await requestTurnDecision(
    buildSystemPrompt(request),
    request.transcript.trim(),
    config,
  )
  const validation = validateDecision(request, initialDecision)

  if (!validation) {
    return initialDecision
  }

  return requestTurnDecision(
    buildRepairSystemPrompt(request, validation.expectedRoute, validation.reason),
    request.transcript.trim(),
    config,
  )
}

async function requestTurnDecision(
  systemPrompt: string,
  userPrompt: string,
  config: ServerConfig['nova'],
): Promise<NovaDecision> {
  const client = getClient(config.region)
  const command = new InvokeModelWithBidirectionalStreamCommand({
    modelId: config.sonicModelId,
    body: buildNovaRequestStream(systemPrompt, userPrompt, config),
  })
  try {
    const response = await client.send(command)
    const rawResponseText = await collectAssistantText(response.body)

    return parseNovaDecision(rawResponseText)
  } catch (error) {
    logBedrockError(error)
    throw error
  }
}

type ValidationIssue = {
  expectedRoute: UserTarget
  reason: string
}

function validateDecision(request: TurnRequest, decision: NovaDecision): ValidationIssue | null {
  if (decision.route === 'Cookie') {
    if (!decision.betterSpanishPhrasing && !extractQuotedPhrasing(decision.reply)) {
      return {
        expectedRoute: 'Cookie',
        reason: 'Cookie must include one better Spanish phrasing.',
      }
    }

    return null
  }

  if (containsDisallowedEnglish(request.transcript)) {
    return {
      expectedRoute: 'Cookie',
      reason: 'The learner transcript still contains English, so Cookie must respond.',
    }
  }

  if (looksLikeCookieReply(decision.reply)) {
    return {
      expectedRoute: 'Cream',
      reason: 'Cream reply drifted into Cookie coaching language.',
    }
  }

  if (!containsSpanish(decision.reply) && !looksLikeSpanishConversationReply(decision.reply)) {
    return {
      expectedRoute: 'Cream',
      reason: 'Cream reply was not natural casual Spanish conversation.',
    }
  }

  return null
}

function buildRepairSystemPrompt(
  request: TurnRequest,
  expectedRoute: UserTarget,
  reason: string,
): string {
  if (expectedRoute === 'Cookie') {
    return [
      'You are repairing a Cookie & Cream turn decision.',
      'Return Cookie JSON only.',
      'Cookie is a warm English tutor for English-speaking intermediate Spanish learners.',
      'Cookie must be brief, encouraging, give exactly one better Spanish phrasing, ask for a retry, and never continue the topic.',
      `Current phase: ${request.phase}.`,
      `Recent messages: ${formatRecentMessages(request.recentMessages)}.`,
      `Repair reason: ${reason}.`,
      'The next USER text input is the reviewed learner transcript for this turn.',
      'Return strict JSON only with {"route":"Cookie","betterSpanishPhrasing":"...","reply":"brief English coaching that asks for a retry"}.',
    ].join('\n')
  }

  return [
    'You are repairing a Cookie & Cream turn decision.',
    'Return Cream JSON only.',
    'Cream is a casual Spanish conversation partner.',
    'Cream must continue the conversation naturally in Spanish, must not teach grammar, and must not sound like Cookie.',
    `Current phase: ${request.phase}.`,
    `Recent messages: ${formatRecentMessages(request.recentMessages)}.`,
    `Repair reason: ${reason}.`,
    'The next USER text input is the reviewed learner transcript for this turn.',
    'Return strict JSON only with {"route":"Cream","reply":"casual Spanish continuation"}.',
  ].join('\n')
}

function looksLikeCookieReply(reply: string): boolean {
  return /nice try|in spanish|try again|you can say|all english|you're close|english part|stayed in english|keep .* in spanish/i.test(
    reply,
  )
}

function looksLikeSpanishConversationReply(reply: string): boolean {
  return /[¿¡]|ah, sí|cuéntame|qué|hoy|después|entiendo/i.test(reply)
}

function stripCookieLeadIn(reply: string): string {
  return reply
    .replace(/^nice try[.!]?\s*/i, '')
    .replace(/^in spanish you can say:\s*/i, '')
    .replace(/^say:\s*/i, '')
}

function extractQuotedPhrasing(reply: string): string | undefined {
  const match = reply.match(/["“]([^"”]+)["”]/)

  return match?.[1]
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["“”']+|["“”']+$/g, '')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

type BuildSonicEventsInput = {
  promptName: string
  systemContentName: string
  userContentName: string
  systemPrompt: string
  reviewedTranscript: string
  config: ServerConfig['nova']
}

function buildSonicEvents(input: BuildSonicEventsInput): SonicInputEvent[] {
  return [
    {
      event: {
        sessionStart: {
          inferenceConfiguration: {
            maxTokens: 220,
            temperature: 0,
            topP: 0.1,
          },
        },
      },
    },
    {
      event: {
        promptStart: {
          promptName: input.promptName,
          textOutputConfiguration: {
            mediaType: 'text/plain',
          },
          audioOutputConfiguration: {
            mediaType: 'audio/lpcm',
            sampleRateHertz: 24000,
            sampleSizeBits: 16,
            channelCount: 1,
            voiceId: input.config.voiceId,
            encoding: 'base64',
            audioType: 'SPEECH',
          },
        },
      },
    },
    createTextContentStartEvent(input.promptName, input.systemContentName, 'SYSTEM', false),
    ...createTextInputEvents(input.promptName, input.systemContentName, input.systemPrompt),
    createContentEndEvent(input.promptName, input.systemContentName),
    createTextContentStartEvent(input.promptName, input.userContentName, 'USER', true),
    ...createTextInputEvents(input.promptName, input.userContentName, input.reviewedTranscript),
    createContentEndEvent(input.promptName, input.userContentName),
    {
      event: {
        promptEnd: {
          promptName: input.promptName,
        },
      },
    },
    {
      event: {
        sessionEnd: {},
      },
    },
  ]
}

function createTextContentStartEvent(
  promptName: string,
  contentName: string,
  role: 'SYSTEM' | 'USER',
  interactive: boolean,
): SonicInputEvent {
  return {
    event: {
      contentStart: {
        promptName,
        contentName,
        type: 'TEXT',
        interactive,
        role,
        textInputConfiguration: {
          mediaType: 'text/plain',
        },
      },
    },
  }
}

function createTextInputEvents(
  promptName: string,
  contentName: string,
  text: string,
): SonicInputEvent[] {
  return chunkText(text).map((chunk) => ({
    event: {
      textInput: {
        promptName,
        contentName,
        content: chunk,
      },
    },
  }))
}

function createContentEndEvent(promptName: string, contentName: string): SonicInputEvent {
  return {
    event: {
      contentEnd: {
        promptName,
        contentName,
      },
    },
  }
}

function parseGenerationStage(additionalModelFields: string | undefined): string {
  if (!additionalModelFields) {
    return 'FINAL'
  }

  try {
    const parsed = JSON.parse(additionalModelFields) as { generationStage?: string }

    return parsed.generationStage ?? 'FINAL'
  } catch {
    return 'FINAL'
  }
}

function logOutboundEvents(events: SonicInputEvent[]): void {
  if (!isDevelopment()) {
    return
  }

  console.info(
    '[sonic] outbound events:',
    events.map((event) => JSON.stringify(event)),
  )
}

function logBedrockError(error: unknown): void {
  const candidate = error as {
    $metadata?: Record<string, unknown>
    $response?: unknown
    message?: string
    name?: string
  }

  console.error('[sonic] request failed:', {
    name: candidate?.name ?? 'Error',
    message: candidate?.message ?? String(error),
    metadata: candidate?.$metadata,
    rawResponse: candidate?.$response ?? null,
  })
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function containsDisallowedEnglish(text: string): boolean {
  const sanitizedText = stripAllowedProperNouns(text)
  const tokens = getLatinWordTokens(sanitizedText)

  return tokens.some((token) => obviousEnglishWords.has(token))
}

function stripAllowedProperNouns(text: string): string {
  return allowedProperNouns.reduce((result, properNoun) => {
    const properNounPattern = new RegExp(`\\b${escapeRegExp(properNoun)}\\b`, 'gi')

    return result.replace(properNounPattern, '')
  }, text)
}

function getLatinWordTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-záéíóúüñ']+/gi) ?? []
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const __testables = {
  buildSonicEvents,
  buildSystemPrompt,
  createAssistantReply,
  validateDecision,
  normalizeNovaDecision,
  parseNovaDecision,
}
