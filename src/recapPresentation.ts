import type { SessionRecap } from './recapApi'
import { containsEnglish, containsSpanish, type Message } from './prototype'
import { normalizeVocabularyEntries, type VocabularyEntry } from './vocabulary'

export type SessionRecapPresentation = {
  nextStep: {
    note: string | null
    prompt: string
  }
  summary: string
  vocabulary: VocabularyEntry[]
}

type SessionStats = {
  detailedTurnCount: number
  mixedLanguageTurnCount: number
  spanishOnlyTurnCount: number
  userTurnCount: number
}

const defaultPracticePrompt = '¿Qué hiciste hoy?'

export function buildSessionRecapPresentation(
  recap: SessionRecap,
  messages: Message[],
): SessionRecapPresentation {
  const stats = getSessionStats(messages)

  return {
    nextStep: buildNextStepPresentation(recap.tryNext, messages),
    summary: buildSummaryLine(messages, stats),
    vocabulary: buildVocabularyRecap(messages),
  }
}

function getSessionStats(messages: Message[]): SessionStats {
  const userMessages = messages.filter((message) => message.speaker === 'User')

  return {
    detailedTurnCount: userMessages.filter((message) => message.text.trim().split(/\s+/).length >= 4).length,
    mixedLanguageTurnCount: userMessages.filter((message) => containsEnglish(message.text)).length,
    spanishOnlyTurnCount: userMessages.filter(
      (message) => containsSpanish(message.text) && !containsEnglish(message.text),
    ).length,
    userTurnCount: userMessages.length,
  }
}

function buildSummaryLine(messages: Message[], stats: SessionStats): string {
  const topic = inferSessionTopic(messages)
  const detailClause =
    stats.detailedTurnCount > 0 ? 'used full-sentence answers' : 'kept the conversation moving'

  if (stats.mixedLanguageTurnCount > 0) {
    return `You practiced ${topic}, ${detailClause}, and switched into English ${formatCount(
      stats.mixedLanguageTurnCount,
    )}.`
  }

  if (stats.spanishOnlyTurnCount === stats.userTurnCount && stats.userTurnCount > 0) {
    return `You practiced ${topic}, ${detailClause}, and stayed in Spanish throughout.`
  }

  return `You practiced ${topic} and kept building your answers in Spanish.`
}

function buildVocabularyRecap(messages: Message[]): VocabularyEntry[] {
  return normalizeVocabularyEntries(
    messages.flatMap((message) => message.vocabulary ?? []),
    4,
  )
}

function buildNextStepPresentation(
  tryNext: string,
  messages: Message[],
): SessionRecapPresentation['nextStep'] {
  const quotedSpanishPrompt = extractQuotedPhrases(tryNext).find(isLikelySpanishPhrase)
  const prompt = quotedSpanishPrompt ?? inferPracticePrompt(messages)
  const note = buildNextStepNote(tryNext, prompt, quotedSpanishPrompt !== undefined)

  return {
    note,
    prompt,
  }
}

function buildNextStepNote(text: string, prompt: string, promptCameFromTryNext: boolean): string | null {
  const normalizedText = normalizeWhitespace(text)

  if (!normalizedText) {
    return null
  }

  if (normalizedText === prompt) {
    return null
  }

  if (promptCameFromTryNext) {
    const textWithoutPrompt = normalizeWhitespace(normalizedText.replace(`"${prompt}"`, ''))

    if (!textWithoutPrompt || /^practice (asking|saying)[: ]*$/i.test(textWithoutPrompt)) {
      return 'Practice this out loud once, then answer it in Spanish.'
    }
  }

  return normalizedText
}

function inferSessionTopic(messages: Message[]): string {
  const normalizedTranscript = normalizeForMatch(messages.map((message) => message.text).join(' '))

  if (matchesAnyKeyword(normalizedTranscript, ['jugo', 'juice', 'cafe', 'pedir', 'muffin', 'bebida'])) {
    return 'ordering drinks'
  }

  if (matchesAnyKeyword(normalizedTranscript, ['restaurante', 'restaurant', 'mesa', 'menu'])) {
    return 'finding a restaurant'
  }

  if (matchesAnyKeyword(normalizedTranscript, ['llamas', 'name', 'nombre', 'presentarte'])) {
    return 'introducing yourself'
  }

  if (matchesAnyKeyword(normalizedTranscript, ['hoy', 'today', 'ayer', 'parque', 'amigos', 'trabajo', 'tacos'])) {
    return 'talking about your day'
  }

  return 'everyday Spanish'
}

function inferPracticePrompt(messages: Message[]): string {
  const normalizedTranscript = normalizeForMatch(messages.map((message) => message.text).join(' '))

  if (matchesAnyKeyword(normalizedTranscript, ['jugo', 'juice', 'cafe', 'pedir', 'muffin', 'bebida'])) {
    return '¿Qué quieres pedir?'
  }

  if (matchesAnyKeyword(normalizedTranscript, ['restaurante', 'restaurant', 'mesa', 'menu'])) {
    return '¿Qué buscas en un restaurante?'
  }

  if (matchesAnyKeyword(normalizedTranscript, ['llamas', 'name', 'nombre', 'presentarte'])) {
    return '¿Cómo te llamas?'
  }

  return defaultPracticePrompt
}

function extractQuotedPhrases(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"|'([^']+)'|“([^”]+)”|‘([^’]+)’/g)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? '')
    .map((match) => normalizeWhitespace(match))
    .filter(Boolean)
}

function isLikelySpanishPhrase(text: string): boolean {
  return containsSpanish(text) && !containsEnglish(text)
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalizeForMatch(keyword)))
}

function formatCount(count: number): string {
  if (count === 1) {
    return 'once'
  }

  if (count === 2) {
    return 'twice'
  }

  return `${count} times`
}

function normalizeForMatch(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
