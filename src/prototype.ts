import { createAdaptiveCookieReply } from './cookieCoach.js'
import { getScriptedTurnDecision, type ScriptedTurnDecision } from './demoScript.js'
import { buildLocalVocabularyEntries, type VocabularyEntry } from './vocabulary.js'

export type Speaker = 'Cream' | 'Cookie' | 'User' | 'System'
export type Phase = 'normal' | 'retry-after-cookie'
export type UserTarget = 'Cream' | 'Cookie'

export type Message = {
  id: string
  speaker: Speaker
  text: string
  target?: UserTarget
  vocabulary?: VocabularyEntry[]
}

export type ConversationState = {
  messages: Message[]
  phase: Phase
}

type SubmitTurnOptions = {
  scenarioId?: string | null
}

const allowedProperNouns = [
  'McDonald',
  "McDonald's",
  'YouTube',
  'Uber',
  'Netflix',
  'Starbucks',
  'Apple',
]

const spanishSignalWords = new Set([
  'a',
  'al',
  'amigos',
  'ayer',
  'calor',
  'casa',
  'con',
  'cuentame',
  'cuéntame',
  'despues',
  'después',
  'el',
  'en',
  'estaba',
  'fue',
  'fui',
  'gracias',
  'hice',
  'hizo',
  'hola',
  'hoy',
  'la',
  'mas',
  'más',
  'mi',
  'mucho',
  'parque',
  'pero',
  'por',
  'que',
  'qué',
  'quiero',
  'trabajo',
  'un',
  'una',
  'vi',
])
const englishSignalWords = new Set([
  'and',
  'after',
  'again',
  'ate',
  'busy',
  'but',
  'cool',
  'did',
  'eated',
  'english',
  'exercise',
  'grocery',
  'good',
  'hello',
  'hey',
  'hi',
  'felt',
  'forgot',
  'hot',
  'home',
  'homework',
  'how',
  'i',
  'meeting',
  'movie',
  'nice',
  'ok',
  'okay',
  'pharmacy',
  'please',
  'really',
  'say',
  'shop',
  'sorry',
  'station',
  'store',
  'test',
  'thank',
  'thanks',
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
const spanishAccentPattern = /[áéíóúüñ¿¡]/i

export const initialConversation: ConversationState = {
  phase: 'normal',
  messages: [],
}

export function containsSpanish(text: string): boolean {
  const normalizedText = stripAllowedProperNouns(text)

  return (
    spanishAccentPattern.test(normalizedText) ||
    getWordTokens(normalizedText).some((token) => spanishSignalWords.has(token))
  )
}

export function containsEnglish(text: string): boolean {
  const normalizedText = stripAllowedProperNouns(text)

  return getWordTokens(normalizedText).some((token) => englishSignalWords.has(token))
}

export function containsAllowedProperNoun(text: string): boolean {
  return allowedProperNouns.some((properNoun) =>
    new RegExp(`\\b${escapeRegExp(properNoun)}\\b`, 'i').test(text),
  )
}

export function shouldRouteToCookie(text: string): boolean {
  return containsEnglish(text)
}

export function submitUserTurn(
  state: ConversationState,
  rawText: string,
  options: SubmitTurnOptions = {},
): ConversationState {
  const text = rawText.trim()

  if (!text) {
    return state
  }

  if (state.phase === 'retry-after-cookie') {
    return resolveRetryTurn(state, text, options)
  }

  return resolveNormalTurn(state, text, options)
}

function resolveNormalTurn(
  state: ConversationState,
  text: string,
  options: SubmitTurnOptions,
): ConversationState {
  const scriptedDecision = getScriptedTurnDecision({
    transcript: text,
    phase: state.phase,
    scenarioId: options.scenarioId,
  })

  if (scriptedDecision) {
    return applyScriptedTurnDecision(state, text, scriptedDecision)
  }

  if (shouldRouteToCookie(text)) {
    const userMessage = createUserMessage(state.messages.length + 1, text, 'Cookie')
    const cookieMessageContent = getCookieMessageContent(text)
    const cookieMessage = createCookieMessage(
      state.messages.length + 2,
      cookieMessageContent.text,
      cookieMessageContent.vocabulary,
    )

    return {
      messages: [...state.messages, userMessage, cookieMessage],
      phase: 'retry-after-cookie',
    }
  }

  const userMessage = createUserMessage(state.messages.length + 1, text, 'Cream')
  const creamMessage = createCreamMessage(state.messages.length + 2, getCreamText(text))

  return {
    messages: [...state.messages, userMessage, creamMessage],
    phase: 'normal',
  }
}

function resolveRetryTurn(
  state: ConversationState,
  text: string,
  options: SubmitTurnOptions,
): ConversationState {
  const scriptedDecision = getScriptedTurnDecision({
    transcript: text,
    phase: state.phase,
    scenarioId: options.scenarioId,
  })

  if (scriptedDecision) {
    return applyScriptedTurnDecision(state, text, scriptedDecision)
  }

  if (isSuccessfulRetry(text)) {
    const userMessage = createUserMessage(state.messages.length + 1, text, 'Cream')
    const creamMessage = createCreamMessage(state.messages.length + 2, getCreamText(text))

    return {
      messages: [...state.messages, userMessage, creamMessage],
      phase: 'normal',
    }
  }

  const userMessage = createUserMessage(state.messages.length + 1, text, 'Cookie')
  const cookieMessageContent = getCookieMessageContent(text)
  const cookieMessage = createCookieMessage(
    state.messages.length + 2,
    cookieMessageContent.text,
    cookieMessageContent.vocabulary,
  )

  return {
    messages: [...state.messages, userMessage, cookieMessage],
    phase: 'retry-after-cookie',
  }
}

function isSuccessfulRetry(text: string): boolean {
  return containsSpanish(text) && !shouldRouteToCookie(text)
}

function createUserMessage(idNumber: number, text: string, target: UserTarget): Message {
  return {
    id: `user-${idNumber}`,
    speaker: 'User',
    text,
    target,
  }
}

function createCookieMessage(idNumber: number, text: string, vocabulary?: VocabularyEntry[]): Message {
  return {
    id: `cookie-${idNumber}`,
    speaker: 'Cookie',
    text,
    vocabulary: vocabulary && vocabulary.length > 0 ? vocabulary : undefined,
  }
}

function createCreamMessage(idNumber: number, text: string): Message {
  return {
    id: `cream-${idNumber}`,
    speaker: 'Cream',
    text,
  }
}

function applyScriptedTurnDecision(
  state: ConversationState,
  text: string,
  decision: ScriptedTurnDecision,
): ConversationState {
  const userMessage = createUserMessage(state.messages.length + 1, text, decision.route)

  if (decision.route === 'Cookie') {
    const fallbackVocabulary = buildLocalVocabularyEntries({
      transcript: text,
      betterSpanishPhrasing: decision.betterSpanishPhrasing,
      reply: decision.reply,
      maxEntries: 2,
    })
    const cookieMessage = createCookieMessage(
      state.messages.length + 2,
      decision.reply,
      decision.vocabulary ?? (fallbackVocabulary.length > 0 ? fallbackVocabulary : undefined),
    )

    return {
      messages: [...state.messages, userMessage, cookieMessage],
      phase: 'retry-after-cookie',
    }
  }

  const creamMessage = createCreamMessage(state.messages.length + 2, decision.reply)

  return {
    messages: [...state.messages, userMessage, creamMessage],
    phase: 'normal',
  }
}

function getCookieMessageContent(text: string): { text: string; vocabulary?: VocabularyEntry[] } {
  let betterSpanishPhrasing: string | undefined

  if (text === 'Hoy fue very hot') {
    betterSpanishPhrasing = 'Hoy hizo mucho calor.'
  }

  if (text === 'Today was very hot') {
    betterSpanishPhrasing = 'Hoy hizo mucho calor.'
  }

  const reply = createAdaptiveCookieReply({
    transcript: text,
    betterSpanishPhrasing,
  })
  const vocabulary = buildLocalVocabularyEntries({
    transcript: text,
    betterSpanishPhrasing,
    reply,
    maxEntries: 2,
  })

  return {
    text: reply,
    vocabulary: vocabulary.length > 0 ? vocabulary : undefined,
  }
}

function getCreamText(text: string): string {
  if (isFreshGreeting(text)) {
    return 'Hola, buenos días. ¿Cómo estás?'
  }

  if (text === 'Hoy hizo mucho calor.') {
    return 'Ah, sí. ¿Qué hiciste después?'
  }

  return 'Entiendo. Cuéntame un poco más.'
}

function isFreshGreeting(text: string): boolean {
  const normalizedText = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalizedText === 'hola buenos dias' || normalizedText.startsWith('hola buenos dias ')
}

function stripAllowedProperNouns(text: string): string {
  return allowedProperNouns.reduce((result, properNoun) => {
    const properNounPattern = new RegExp(`\\b${escapeRegExp(properNoun)}\\b`, 'gi')

    return result.replace(properNounPattern, '')
  }, text)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getWordTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-záéíóúüñ']+/gi) ?? []
}
