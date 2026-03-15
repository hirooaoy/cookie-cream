import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'
import type { ServerConfig } from './config.js'
import { createAdaptiveCookieReply } from '../src/cookieCoach.js'
import { getScriptedTurnDecision } from '../src/demoScript.js'
import { containsSpanish, type Message, type Phase, type UserTarget } from '../src/prototype.js'
import type { TurnRequest, TurnResponse } from '../src/turnApi.js'
import { buildLocalVocabularyEntries, normalizeVocabularyEntries, type VocabularyEntry } from '../src/vocabulary.js'

type NovaDecision = {
  route: UserTarget
  reply: string
  betterSpanishPhrasing?: string
  containsEnglish?: boolean
  englishSpans?: string[]
  vocabulary?: VocabularyEntry[]
}

type ValidationIssue = {
  expectedRoute: UserTarget
  reason: string
}

const allowedProperNouns = ['McDonald', "McDonald's", 'YouTube', 'Uber', 'Netflix', 'Starbucks', 'Apple']
const obviousEnglishWords = new Set([
  'and',
  'again',
  'ate',
  'busy',
  'but',
  'cool',
  'did',
  'eated',
  'exercise',
  'grocery',
  'good',
  'hello',
  'hey',
  'hi',
  'home',
  'homework',
  'hot',
  'how',
  'i',
  'meeting',
  'movie',
  'nice',
  'okay',
  'ok',
  'pharmacy',
  'please',
  'really',
  'say',
  'shop',
  'sorry',
  'station',
  'store',
  'test',
  'thanks',
  'thank',
  'then',
  'theater',
  'tired',
  'today',
  'train',
  'try',
  'very',
  'was',
  'what',
  'with',
  'yeah',
  'yes',
])

let cachedClient: BedrockRuntimeClient | null = null
let cachedRegion: string | null = null

// Reader note:
// This file is intentionally stricter than a "prompt in, response out" demo layer.
// In practice, keeping Cookie and Cream distinct is product logic, not prompt luck. We
// let Nova draft the decision, then validate, normalize, and if needed repair the
// output so the user experience stays consistent even when the model is slightly loose.
// That defensive policy code is here on purpose; it was the fastest way to make the
// judged behavior reliable without pretending the model would always follow instructions
// perfectly on the first pass.
export async function resolveNovaTextTurnRequest(
  request: TurnRequest,
  config: ServerConfig['nova'],
): Promise<TurnResponse> {
  const decision = await generateTurnDecision(request, config)

  return createNovaTurnResponse(request, decision, config.textModelId)
}

function getClient(region: string): BedrockRuntimeClient {
  if (!cachedClient || cachedRegion !== region) {
    cachedClient = new BedrockRuntimeClient({ region })
    cachedRegion = region
  }

  return cachedClient
}

async function generateTurnDecision(
  request: TurnRequest,
  config: ServerConfig['nova'],
): Promise<NovaDecision> {
  const scriptedDecision = getScriptedTurnDecision({
    transcript: request.transcript,
    phase: request.phase,
    scenarioId: request.scenarioId,
  })

  if (scriptedDecision) {
    return {
      route: scriptedDecision.route,
      reply: scriptedDecision.reply,
      betterSpanishPhrasing: scriptedDecision.betterSpanishPhrasing,
      containsEnglish: scriptedDecision.route === 'Cookie',
      englishSpans: scriptedDecision.englishSpans,
      vocabulary: scriptedDecision.vocabulary,
    }
  }

  const expectedRoute = inferExpectedRoute(request)
  const initialDecision = await requestTurnDecision(
    buildSystemPrompt(request, expectedRoute),
    request.transcript.trim(),
    config,
  )
  const validation = validateDecision(request, initialDecision, expectedRoute)

  if (!validation) {
    return initialDecision
  }

  // A second constrained pass was a better hackathon tradeoff than building a much
  // larger hand-authored router for every edge case. We keep the retry narrow and
  // explicit so the model fixes the failure mode we observed instead of rethinking the
  // whole turn from scratch.
  return requestTurnDecision(
    buildRepairSystemPrompt(request, validation.expectedRoute, validation.reason),
    request.transcript.trim(),
    config,
  )
}

async function requestTurnDecision(
  systemPrompt: string,
  reviewedTranscript: string,
  config: ServerConfig['nova'],
): Promise<NovaDecision> {
  const input: ConverseCommandInput = {
    modelId: config.textModelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: reviewedTranscript }],
      },
    ],
    inferenceConfig: {
      maxTokens: 220,
      temperature: 0,
      topP: 0.1,
    },
  }

  logTextRequest(config.textModelId, reviewedTranscript)

  try {
    const response = await getClient(config.region).send(new ConverseCommand(input))
    const rawResponseText = extractConverseText(response)

    return parseNovaDecision(rawResponseText)
  } catch (error) {
    logBedrockError(error)
    throw error
  }
}

function extractConverseText(response: ConverseCommandOutput): string {
  const text = response.output?.message?.content
    ?.map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .join('')
    .trim()

  if (!text) {
    throw new Error('Nova text path returned an empty response.')
  }

  return text
}

function parseNovaDecision(rawResponseText: string): NovaDecision {
  const candidate = extractJsonObject(rawResponseText)
  const parsed = JSON.parse(candidate) as Partial<NovaDecision>

  if ((parsed.route !== 'Cookie' && parsed.route !== 'Cream') || typeof parsed.reply !== 'string') {
    throw new Error('Nova text path returned an invalid decision payload.')
  }

  const reply = parsed.reply.trim()

  if (!reply) {
    throw new Error('Nova text path returned an empty reply.')
  }

  return {
    route: parsed.route,
    reply,
    betterSpanishPhrasing:
      typeof parsed.betterSpanishPhrasing === 'string' ? parsed.betterSpanishPhrasing.trim() : undefined,
    containsEnglish: typeof parsed.containsEnglish === 'boolean' ? parsed.containsEnglish : undefined,
    englishSpans: normalizeEnglishSpans(parsed.englishSpans),
    vocabulary: normalizeVocabularyEntries(parsed.vocabulary),
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
    throw new Error('Nova text path response did not include JSON.')
  }

  return cleaned.slice(startIndex, endIndex + 1)
}

function buildSystemPrompt(request: TurnRequest, expectedRoute: UserTarget | null): string {
  const lines = [
    'You are the core turn router for Cookie & Cream.',
    'Cookie is a warm English tutor for English-speaking intermediate Spanish learners.',
    'Cream is a casual Spanish conversation partner.',
    'Route Cookie if the learner uses any English beyond allowed proper nouns.',
    'Always decide explicitly whether the learner transcript contains English beyond allowed proper nouns.',
    'English nouns and place names still count as English, including Grocery Store, movie theater, coffee shop, meeting, pharmacy, and train station.',
    'Single English words still count as English, including hi, hello, test, thanks, and okay.',
    'English connectors and learner-mistake words like and, then, with, but, busy, tired, home, homework, exercise, ate, and eated still count as English.',
    'When phase is retry-after-cookie, only route back to Cream if the learner now stays in Spanish.',
    'Cookie must speak in English only, except for the single better Spanish phrasing.',
    'Cookie must be brief, warm, encouraging, give one better Spanish phrasing, and never continue the topic.',
    'Cookie should sound like a coach, not a chat partner.',
    'Cookie should adapt its wording to the mistake type instead of repeating one fixed script.',
    'When route is Cookie, include vocabulary as an array of one to two useful Spanish words or short phrases from the better Spanish phrasing.',
    'Each vocabulary item must use the shape {"term":"...","translation":"..."}.',
    'Prefer concrete content words over filler words unless the filler word is the main correction.',
    'If the learner stayed fully in English, Cookie should say that clearly and then give the Spanish version.',
    'If the learner mixed Spanish and English, Cookie should say they are close, point out the English part, and give the Spanish version.',
    'Cookie must not give grammar explanations, multiple alternatives, or long teaching notes.',
    'Cream must speak in Spanish only.',
    'Cream must continue the conversation naturally in casual Spanish, keep the thread moving, never teach grammar, and never sound like Cookie.',
    'Cream can ask one short natural follow-up question in Spanish.',
    'Allowed proper nouns: McDonald\'s, YouTube, Uber, Netflix, Starbucks, Apple.',
    'Examples:',
    '{"route":"Cookie","containsEnglish":true,"englishSpans":["Today was very hot"],"betterSpanishPhrasing":"Hoy hizo mucho calor.","vocabulary":[{"term":"calor","translation":"heat"},{"term":"hoy","translation":"today"}],"reply":"That was all English. In Spanish, say: \\"Hoy hizo mucho calor.\\" Try again."} for transcript "Today was very hot".',
    '{"route":"Cookie","containsEnglish":true,"englishSpans":["very hot"],"betterSpanishPhrasing":"Hoy hizo mucho calor.","vocabulary":[{"term":"calor","translation":"heat"},{"term":"mucho calor","translation":"very hot"}],"reply":"You\'re close. \\"very hot\\" should be Spanish here. Say: \\"Hoy hizo mucho calor.\\""} for transcript "Hoy fue very hot".',
    '{"route":"Cookie","containsEnglish":true,"englishSpans":["Grocery Store"],"betterSpanishPhrasing":"Hoy fui al supermercado.","vocabulary":[{"term":"supermercado","translation":"grocery store"},{"term":"fui","translation":"I went"}],"reply":"You\'re close. \\"Grocery Store\\" should be Spanish here. Say: \\"Hoy fui al supermercado.\\""} for transcript "Hoy fui a Grocery Store".',
    '{"route":"Cookie","containsEnglish":true,"englishSpans":["hi"],"betterSpanishPhrasing":"Hola.","vocabulary":[{"term":"hola","translation":"hello"}],"reply":"That was all English. In Spanish, say: \\"Hola.\\" Try again."} for transcript "hi".',
    '{"route":"Cream","containsEnglish":false,"englishSpans":[],"vocabulary":[],"reply":"Ah, sí. ¿Qué hiciste después?"} for transcript "Hoy hizo mucho calor." after Cookie.',
    `Current phase: ${request.phase}.`,
    `Learner language: ${request.learnerLanguage}.`,
    `Target language: ${request.targetLanguage}.`,
    'Recent messages:',
    formatRecentMessages(request.recentMessages),
    'The next USER message is the reviewed learner transcript for this turn.',
    'Return strict JSON only.',
    'Do not output markdown.',
    'Do not output code fences.',
    'Do not output explanations before or after the JSON.',
    'Do not output any keys other than route, containsEnglish, englishSpans, reply, betterSpanishPhrasing, and vocabulary.',
    'If route is Cookie, respond with {"route":"Cookie","containsEnglish":true,"englishSpans":["..."],"betterSpanishPhrasing":"...","vocabulary":[{"term":"...","translation":"..."}],"reply":"short adaptive English coaching"}',
    'If route is Cream, respond with {"route":"Cream","containsEnglish":false,"englishSpans":[],"vocabulary":[],"reply":"casual Spanish continuation"}',
  ]

  if (expectedRoute) {
    lines.push(`The route for this turn is fixed to ${expectedRoute}. Keep that route.`)
  }

  return lines.join('\n')
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
      'Cookie must speak in English only, except for the single better Spanish phrasing.',
      'Cookie must be brief, encouraging, give exactly one better Spanish phrasing, and never continue the topic.',
      'Cookie should sound like a coach, not a chat partner.',
      'Cookie should adapt its wording to the mistake type instead of repeating one fixed script.',
      'Cookie must not give grammar explanations, multiple alternatives, or long teaching notes.',
      'Return containsEnglish true and list the exact English word or phrase in englishSpans.',
      `Current phase: ${request.phase}.`,
      `Recent messages: ${formatRecentMessages(request.recentMessages)}.`,
      `Repair reason: ${reason}.`,
      'The next USER message is the reviewed learner transcript for this turn.',
      'Return strict JSON only with no markdown, no code fences, and no extra prose.',
      'Return strict JSON only with {"route":"Cookie","containsEnglish":true,"englishSpans":["..."],"betterSpanishPhrasing":"...","reply":"short adaptive English coaching"}.',
    ].join('\n')
  }

  return [
    'You are repairing a Cookie & Cream turn decision.',
    'Return Cream JSON only.',
    'Cream is a casual Spanish conversation partner.',
    'Cream must speak in Spanish only.',
    'Cream must continue the conversation naturally in Spanish, keep the thread moving, must not teach grammar, and must not sound like Cookie.',
    'Return containsEnglish false and an empty englishSpans array.',
    `Current phase: ${request.phase}.`,
    `Recent messages: ${formatRecentMessages(request.recentMessages)}.`,
    `Repair reason: ${reason}.`,
    'The next USER message is the reviewed learner transcript for this turn.',
    'Return strict JSON only with no markdown, no code fences, and no extra prose.',
    'Return strict JSON only with {"route":"Cream","containsEnglish":false,"englishSpans":[],"reply":"casual Spanish continuation"}.',
  ].join('\n')
}

function formatRecentMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return '(none)'
  }

  return messages.slice(-8).map((message) => `${message.speaker}: ${message.text}`).join('\n')
}

function validateDecision(
  request: TurnRequest,
  decision: NovaDecision,
  expectedRoute: UserTarget | null,
): ValidationIssue | null {
  // The validation rules are intentionally opinionated because the product promise is
  // opinionated: Cookie repairs, Cream converses. If those roles blur even once in a
  // short demo, the core idea becomes harder to understand.
  if (expectedRoute && decision.route !== expectedRoute) {
    return {
      expectedRoute,
      reason: `The learner transcript clearly maps to ${expectedRoute}, so the route must be ${expectedRoute}.`,
    }
  }

  if (decision.route === 'Cookie') {
    if (!containsModelDetectedEnglish(decision) && !containsDisallowedEnglish(request.transcript)) {
      return {
        expectedRoute: 'Cookie',
        reason: 'Cookie route must explicitly mark the English word or phrase in the transcript.',
      }
    }

    if (!decision.betterSpanishPhrasing && !extractQuotedPhrasing(decision.reply)) {
      return {
        expectedRoute: 'Cookie',
        reason: 'Cookie must include one better Spanish phrasing.',
      }
    }

    if (looksLikeTopicContinuation(decision.reply)) {
      return {
        expectedRoute: 'Cookie',
        reason: 'Cookie must coach and ask for a retry, not continue the conversation topic.',
      }
    }

    if (isCookieReplyTooLong(decision.reply)) {
      return {
        expectedRoute: 'Cookie',
        reason: 'Cookie coaching must stay short and focused.',
      }
    }

    if (looksLikeTeacherLecture(decision.reply)) {
      return {
        expectedRoute: 'Cookie',
        reason: 'Cookie coaching must avoid grammar lectures and long teaching notes.',
      }
    }

    return null
  }

  if (containsModelDetectedEnglish(decision) || containsDisallowedEnglish(request.transcript)) {
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

  if (containsDisallowedEnglish(decision.reply)) {
    return {
      expectedRoute: 'Cream',
      reason: 'Cream reply must stay in Spanish.',
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

function inferExpectedRoute(request: TurnRequest): UserTarget | null {
  if (containsDisallowedEnglish(request.transcript)) {
    return 'Cookie'
  }

  if (containsSpanish(request.transcript)) {
    return 'Cream'
  }

  return null
}

function createNovaTurnResponse(
  request: TurnRequest,
  decision: NovaDecision,
  modelId: string,
): TurnResponse {
  const normalizedDecision = normalizeNovaDecision(decision)
  const nextIndex = request.recentMessages.length + 1
  const assistantReply = createAssistantReply(request, normalizedDecision)
  const userMessage: Message = {
    id: `user-${nextIndex}`,
    speaker: 'User',
    text: request.transcript.trim(),
    target: normalizedDecision.route,
  }
  const assistantMessage: Message = {
    id: `${normalizedDecision.route.toLowerCase()}-${nextIndex + 1}`,
    speaker: normalizedDecision.route,
    text: assistantReply,
    vocabulary:
      normalizedDecision.route === 'Cookie'
        ? getAssistantVocabulary(request, normalizedDecision, assistantReply)
        : undefined,
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

function normalizeNovaDecision(decision: NovaDecision): NovaDecision {
  const inferredBetterSpanishPhrasing =
    decision.betterSpanishPhrasing ?? extractQuotedPhrasing(decision.reply)
  const englishSpans = normalizeEnglishSpans(decision.englishSpans)

  return {
    route: decision.route,
    reply: normalizeWhitespace(decision.reply),
    betterSpanishPhrasing: inferredBetterSpanishPhrasing
      ? normalizeWhitespace(stripWrappingQuotes(inferredBetterSpanishPhrasing))
      : undefined,
    containsEnglish: decision.containsEnglish === true || englishSpans.length > 0,
    englishSpans,
    vocabulary: normalizeVocabularyEntries(decision.vocabulary),
  }
}

function getAssistantVocabulary(
  request: TurnRequest,
  decision: NovaDecision,
  assistantReply: string,
): VocabularyEntry[] | undefined {
  // We prefer model-provided vocabulary, but keep a local fallback so the recap and UI
  // stay informative even when the model omits auxiliary structure. That is a demo
  // reliability choice rather than a statement that the fallback logic is "better."
  const modelVocabulary = normalizeVocabularyEntries(decision.vocabulary, 2)

  if (modelVocabulary.length > 0) {
    return modelVocabulary
  }

  const fallbackVocabulary = buildLocalVocabularyEntries({
    transcript: request.transcript,
    betterSpanishPhrasing: decision.betterSpanishPhrasing,
    reply: assistantReply,
    maxEntries: 2,
  })

  return fallbackVocabulary.length > 0 ? fallbackVocabulary : undefined
}

function createAssistantReply(request: TurnRequest, decision: NovaDecision): string {
  const scriptedDecision = getScriptedTurnDecision({
    transcript: request.transcript,
    phase: request.phase,
    scenarioId: request.scenarioId,
  })

  if (scriptedDecision && scriptedDecision.route === decision.route) {
    return scriptedDecision.reply
  }

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

function getNextPhase(route: UserTarget): Phase {
  return route === 'Cookie' ? 'retry-after-cookie' : 'normal'
}

function looksLikeCookieReply(reply: string): boolean {
  return /nice try|in spanish|try again|you can say|all english|you're close|english part|stayed in english|keep .* in spanish/i.test(
    reply,
  )
}

function looksLikeSpanishConversationReply(reply: string): boolean {
  return /[¿¡]|ah, sí|cuéntame|qué|hoy|después|entiendo/i.test(reply)
}

function looksLikeTopicContinuation(reply: string): boolean {
  const outsideQuotedPhrasing = stripQuotedSegments(reply)

  return /[?¿]|cuéntame|qué|después|luego|cómo|dónde|hiciste|fuiste/i.test(outsideQuotedPhrasing)
}

function isCookieReplyTooLong(reply: string): boolean {
  const outsideQuotedPhrasing = stripQuotedSegments(reply)
  const wordCount = outsideQuotedPhrasing.split(/\s+/).filter(Boolean).length

  return wordCount > 16
}

function looksLikeTeacherLecture(reply: string): boolean {
  const outsideQuotedPhrasing = stripQuotedSegments(reply)

  return /grammar|verb|tense|conjugat|article|preposition|subject|object|formal|informal|because|means/i.test(
    outsideQuotedPhrasing,
  )
}

function extractQuotedPhrasing(reply: string): string | undefined {
  const match = reply.match(/["“]([^"”]+)["”]/)

  return match?.[1]
}

function stripQuotedSegments(reply: string): string {
  return normalizeWhitespace(reply.replace(/["“][^"”]+["”]/g, ' '))
}

function stripCookieLeadIn(reply: string): string {
  return reply
    .replace(/^nice try[.!]?\s*/i, '')
    .replace(/^in spanish you can say:\s*/i, '')
    .replace(/^say:\s*/i, '')
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["“”']+|["“”']+$/g, '')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeEnglishSpans(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeWhitespace(stripWrappingQuotes(item)))
    .filter(Boolean)
}

function containsModelDetectedEnglish(decision: NovaDecision): boolean {
  return decision.containsEnglish === true || (decision.englishSpans?.length ?? 0) > 0
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

function logTextRequest(modelId: string, transcript: string): void {
  if (!isDevelopment()) {
    return
  }

  console.info('[nova-text] request:', {
    modelId,
    transcript,
  })
}

function logBedrockError(error: unknown): void {
  const candidate = error as {
    $metadata?: Record<string, unknown>
    $response?: unknown
    message?: string
    name?: string
  }

  console.error('[nova-text] request failed:', {
    name: candidate?.name ?? 'Error',
    message: candidate?.message ?? String(error),
    metadata: candidate?.$metadata,
    rawResponse: candidate?.$response ?? null,
  })
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export const __testables = {
  buildSystemPrompt,
  createNovaTurnResponse,
  createAssistantReply,
  extractConverseText,
  inferExpectedRoute,
  createCookieReply,
  isCookieReplyTooLong,
  looksLikeTeacherLecture,
  looksLikeTopicContinuation,
  normalizeNovaDecision,
  parseNovaDecision,
  validateDecision,
}
