const allowedProperNouns = [
  'McDonald',
  "McDonald's",
  'YouTube',
  'Uber',
  'Netflix',
  'Starbucks',
  'Apple',
]

const englishSignalWords = new Set([
  'after',
  'again',
  'and',
  'ate',
  'busy',
  'but',
  'cool',
  'did',
  'eated',
  'english',
  'exercise',
  'felt',
  'forgot',
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

const spanishAccentPattern = /[áéíóúüñ¿¡]/i

type CookieTurnKind = 'all-english' | 'mixed' | 'general'

type CookieReplyTemplate = (context: {
  betterSpanishPhrasing: string
  englishSnippet?: string
  snippetTranslation?: string
}) => string

const commonEnglishToSpanish: Record<string, string> = {
  after: 'despues',
  and: 'y',
  busy: 'ocupado',
  'coffee shop': 'cafeteria',
  'grocery store': 'supermercado',
  grocery: 'supermercado',
  hello: 'hola',
  hi: 'hola',
  home: 'casa',
  homework: 'tarea',
  hot: 'caluroso',
  how: 'como',
  meeting: 'reunion',
  'movie theater': 'cine',
  pharmacy: 'farmacia',
  really: 'de verdad',
  shop: 'tienda',
  station: 'estacion',
  store: 'tienda',
  thanks: 'gracias',
  theater: 'cine',
  tired: 'cansado',
  today: 'hoy',
  'train station': 'estacion de tren',
  train: 'tren',
  very: 'muy',
  what: 'que',
  with: 'con',
  'very hot': 'mucho calor',
}

const allEnglishTemplates: CookieReplyTemplate[] = [
  ({ betterSpanishPhrasing }) => `That was all English. In Spanish, say: "${betterSpanishPhrasing}" Try again.`,
  ({ betterSpanishPhrasing }) => `You stayed in English there. Try: "${betterSpanishPhrasing}"`,
  ({ betterSpanishPhrasing }) => `No Spanish yet. Say: "${betterSpanishPhrasing}" and give it another try.`,
]

const mixedTemplates: CookieReplyTemplate[] = [
  ({ betterSpanishPhrasing, englishSnippet, snippetTranslation }) =>
    snippetTranslation && englishSnippet
      ? `You're close. "${englishSnippet}" is "${snippetTranslation}" in Spanish. Say: "${betterSpanishPhrasing}"`
      : `You're close. "${englishSnippet ?? 'That English part'}" is still in English. Say: "${betterSpanishPhrasing}"`,
  ({ betterSpanishPhrasing, englishSnippet, snippetTranslation }) =>
    snippetTranslation && englishSnippet
      ? `Almost there. In Spanish, "${englishSnippet}" is "${snippetTranslation}". Try: "${betterSpanishPhrasing}"`
      : `Almost there. "${englishSnippet ?? 'That part'}" is still in English. Try: "${betterSpanishPhrasing}"`,
  ({ betterSpanishPhrasing, englishSnippet, snippetTranslation }) =>
    snippetTranslation && englishSnippet
      ? `You're close. Use "${snippetTranslation}" instead of "${englishSnippet}". Say: "${betterSpanishPhrasing}"`
      : `You're close. Keep "${englishSnippet ?? 'that part'}" in Spanish too. Say: "${betterSpanishPhrasing}"`,
]

const generalTemplates: CookieReplyTemplate[] = [
  ({ betterSpanishPhrasing }) => `You're close. Say: "${betterSpanishPhrasing}"`,
  ({ betterSpanishPhrasing }) => `Try it this way: "${betterSpanishPhrasing}"`,
  ({ betterSpanishPhrasing }) => `A better Spanish version is: "${betterSpanishPhrasing}"`,
]

const allEnglishRetryTemplates = [
  'That was all English. Try saying it in Spanish.',
  'You stayed in English there. Give it another try in Spanish.',
  'No Spanish yet. Try the whole idea in Spanish.',
]

const mixedRetryTemplates = [
  'You\'re close. Keep the whole sentence in Spanish and try again.',
  'Almost there. Switch the English part into Spanish and try again.',
  'You\'re close. Say the whole thing in Spanish one more time.',
]

const generalRetryTemplates = [
  'Try that again in Spanish.',
  'Give that another try in Spanish.',
  'Say the whole idea in Spanish.',
]

export function createAdaptiveCookieReply(input: {
  transcript: string
  betterSpanishPhrasing?: string
  fallbackReply?: string
}): string {
  const transcript = normalizeWhitespace(input.transcript)
  const betterSpanishPhrasing = normalizeBetterSpanishPhrasing(input.betterSpanishPhrasing)
  const turnKind = getCookieTurnKind(transcript)
  const englishSnippet = getFirstEnglishSnippet(transcript)
  const snippetTranslation = getSnippetTranslation(englishSnippet)

  if (betterSpanishPhrasing) {
    return pickTemplate(turnKind, transcript)({
      betterSpanishPhrasing,
      englishSnippet,
      snippetTranslation,
    })
  }

  const fallbackReply = normalizeFallbackReply(input.fallbackReply)

  if (fallbackReply) {
    return fallbackReply
  }

  return pickRetryTemplate(turnKind, transcript)
}

function pickTemplate(kind: CookieTurnKind, transcript: string): CookieReplyTemplate {
  const templates =
    kind === 'all-english' ? allEnglishTemplates : kind === 'mixed' ? mixedTemplates : generalTemplates

  return templates[getDeterministicIndex(`${kind}:${transcript}`, templates.length)]
}

function pickRetryTemplate(kind: CookieTurnKind, transcript: string): string {
  const templates =
    kind === 'all-english'
      ? allEnglishRetryTemplates
      : kind === 'mixed'
        ? mixedRetryTemplates
        : generalRetryTemplates

  return templates[getDeterministicIndex(`retry:${kind}:${transcript}`, templates.length)]
}

function getCookieTurnKind(transcript: string): CookieTurnKind {
  const sanitizedTranscript = stripAllowedProperNouns(transcript)
  const tokens = getWordTokens(sanitizedTranscript)
  const hasEnglish = tokens.some((token) => englishSignalWords.has(token))
  const hasSpanish = spanishAccentPattern.test(sanitizedTranscript) || tokens.some((token) => spanishSignalWords.has(token))

  if (hasEnglish && hasSpanish) {
    return 'mixed'
  }

  if (hasEnglish) {
    return 'all-english'
  }

  return 'general'
}

function getFirstEnglishSnippet(transcript: string): string | undefined {
  const sanitizedTranscript = stripAllowedProperNouns(transcript)
  const tokens = sanitizedTranscript.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+/g) ?? []
  const snippetTokens: string[] = []

  for (const token of tokens) {
    const normalizedToken = normalizeWord(token)

    if (englishSignalWords.has(normalizedToken)) {
      snippetTokens.push(token)
      continue
    }

    if (snippetTokens.length > 0) {
      break
    }
  }

  return snippetTokens.length > 0 ? snippetTokens.join(' ') : undefined
}

function normalizeFallbackReply(reply: string | undefined): string | undefined {
  if (!reply) {
    return undefined
  }

  const normalizedReply = normalizeWhitespace(
    reply
      .replace(/^nice try[.!]?\s*/i, '')
      .replace(/^in spanish you can say:\s*/i, '')
      .replace(/^say:\s*/i, ''),
  )

  return normalizedReply || undefined
}

function normalizeBetterSpanishPhrasing(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalizedValue = normalizeWhitespace(value).replace(/^["“”']+|["“”']+$/g, '')

  if (!normalizedValue) {
    return undefined
  }

  return `${normalizedValue.replace(/[.!?]+$/g, '')}.`
}

function getSnippetTranslation(englishSnippet: string | undefined): string | undefined {
  if (!englishSnippet) {
    return undefined
  }

  return commonEnglishToSpanish[normalizeSnippetKey(englishSnippet)]
}

function normalizeSnippetKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getDeterministicIndex(seed: string, size: number): number {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return hash % size
}

function stripAllowedProperNouns(text: string): string {
  return allowedProperNouns.reduce((result, properNoun) => {
    const properNounPattern = new RegExp(`\\b${escapeRegExp(properNoun)}\\b`, 'gi')

    return result.replace(properNounPattern, '')
  }, text)
}

function normalizeWord(value: string): string {
  return value
    .replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+/, '')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+$/, '')
    .toLowerCase()
}

function getWordTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-záéíóúüñ']+/gi) ?? []
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
