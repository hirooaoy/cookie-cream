import { containsEnglish, containsSpanish, type Speaker } from './prototype.js'

export type AgentSpeaker = Exclude<Speaker, 'User'>

export type TranslationRequest = {
  text: string
  speaker: AgentSpeaker
  learnerLanguage: string
  targetLanguage: string
}

export type TranslationMeta = {
  source: 'nova' | 'local-fallback'
  modelId?: string
}

export type TranslationResponse = {
  translation: string
  meta: TranslationMeta
}

const exactEnglishTranslations = new Map<string, string>([
  ['hola', 'Hi.'],
  ['hola como te llamas y que hiciste hoy', 'Hi. What is your name and what did you do today?'],
  ['hola que quieres pedir', 'Hi. What would you like to order?'],
  ['hola buscas un restaurante', 'Hi. Are you looking for a restaurant?'],
  ['ah si', 'Ah, yes.'],
  ['ah si que hiciste despues', 'Ah, yes. What did you do afterward?'],
  ['que hiciste hoy', 'What did you do today?'],
  ['que hiciste despues', 'What did you do afterward?'],
  ['que quieres pedir', 'What would you like to order?'],
  ['buscas un restaurante', 'Are you looking for a restaurant?'],
  ['como te llamas', 'What is your name?'],
  ['entiendo', 'I understand.'],
  ['cuentame un poco mas', 'Tell me a little more.'],
  ['entiendo cuentame un poco mas', 'I understand. Tell me a little more.'],
  ['hoy hizo mucho calor', 'It was very hot today.'],
  ['fui al parque con mis amigos', 'I went to the park with my friends.'],
  ['comi tacos', 'I ate tacos.'],
  ['quiero un cafe con leche y un muffin', 'I want a cafe latte and a muffin.'],
])

export function resolveLocalTranslation(request: TranslationRequest): TranslationResponse {
  return {
    translation: translateToLearnerLanguage(request),
    meta: {
      source: 'local-fallback',
    },
  }
}

function translateToLearnerLanguage(request: TranslationRequest): string {
  const text = normalizeWhitespace(request.text)

  if (!text) {
    return ''
  }

  if (request.speaker === 'Cookie' || (containsEnglish(text) && !containsSpanish(text))) {
    return translateQuotedSegments(text)
  }

  const directTranslation = translateSpanishText(text)
  return directTranslation || text
}

function translateQuotedSegments(text: string): string {
  let didReplace = false

  const translatedText = text.replace(/"([^"]+)"/g, (_, quotedText: string) => {
    const translation = translateSpanishText(quotedText)

    if (!translation || translation === quotedText) {
      return `"${quotedText}"`
    }

    didReplace = true
    return `"${translation}"`
  })

  return didReplace ? translatedText : text
}

function translateSpanishText(text: string): string {
  const directTranslation = exactEnglishTranslations.get(normalizeLookupKey(text))

  if (directTranslation) {
    return directTranslation
  }

  const translatedSegments = splitIntoSegments(text).map((segment) => {
    const exactSegmentTranslation = exactEnglishTranslations.get(normalizeLookupKey(segment))
    return exactSegmentTranslation ?? segment.trim()
  })

  const translation = normalizeWhitespace(translatedSegments.join(' '))
  return translation === text.trim() ? text.trim() : translation
}

function splitIntoSegments(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]?/g)

  if (!matches) {
    return [text]
  }

  return matches.map((segment) => segment.trim()).filter(Boolean)
}

function normalizeLookupKey(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿¡]/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
