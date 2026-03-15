export type VocabularyEntry = {
  term: string
  translation: string
}

const fallbackVocabularyGlossary: Record<string, string> = {
  agua: 'water',
  agregar: 'to add',
  amigo: 'friend',
  amigos: 'friends',
  autobus: 'bus',
  ayer: 'yesterday',
  buscar: 'to look for',
  buscas: 'you are looking for',
  cafe: 'coffee',
  cafeteria: 'cafe',
  calor: 'heat',
  caluroso: 'hot',
  casa: 'home',
  cerca: 'near',
  como: 'how',
  cuentame: 'tell me',
  despues: 'after',
  gracias: 'thank you',
  hace: 'it is',
  hice: 'I did',
  hiciste: 'you did',
  helado: 'iced',
  hielo: 'ice',
  hola: 'hello',
  hoy: 'today',
  leche: 'milk',
  llamas: 'you are called',
  llamo: 'I am called',
  muffin: 'muffin',
  mucho: 'a lot',
  nombre: 'name',
  parque: 'park',
  pedi: 'I ordered',
  pedir: 'to order',
  perdi: 'I missed',
  quiero: 'I want',
  restaurante: 'restaurant',
  sandwich: 'sandwich',
  sentarme: 'to sit down',
  supermercado: 'grocery store',
  tambien: 'also',
  trabajo: 'work',
  ventana: 'window',
}

const deEmphasizedFallbackTerms = new Set([
  'como',
  'cuentame',
  'hace',
  'hice',
  'hiciste',
  'hoy',
  'llamas',
  'llamo',
  'mucho',
  'quiero',
])

export function normalizeVocabularyEntries(value: unknown, maxEntries = 3): VocabularyEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const entries: VocabularyEntry[] = []
  const seenTerms = new Set<string>()

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue
    }

    const term = normalizeVocabularyDisplayText(candidate.term)
    const translation = normalizeVocabularyDisplayText(candidate.translation)
    const glossaryKey = normalizeVocabularyKey(term)

    if (!term || !translation || !glossaryKey || seenTerms.has(glossaryKey)) {
      continue
    }

    entries.push({
      term: term.toLocaleLowerCase(),
      translation,
    })
    seenTerms.add(glossaryKey)

    if (entries.length >= maxEntries) {
      return entries
    }
  }

  return entries
}

export function buildLocalVocabularyEntries(input: {
  transcript: string
  betterSpanishPhrasing?: string
  reply?: string
  maxEntries?: number
}): VocabularyEntry[] {
  const maxEntries = input.maxEntries ?? 3
  const candidateTexts = [input.betterSpanishPhrasing, ...getQuotedSegments(input.reply), input.transcript].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  const primaryEntries: VocabularyEntry[] = []
  const secondaryEntries: VocabularyEntry[] = []
  const seenTerms = new Set<string>()

  for (const candidateText of candidateTexts) {
    const tokens = candidateText.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+/g) ?? []

    for (const token of tokens) {
      const glossaryKey = normalizeVocabularyKey(token)
      const translation = fallbackVocabularyGlossary[glossaryKey]

      if (!translation || seenTerms.has(glossaryKey)) {
        continue
      }

      const entry = {
        term: token.toLocaleLowerCase(),
        translation,
      }

      if (deEmphasizedFallbackTerms.has(glossaryKey)) {
        secondaryEntries.push(entry)
      } else {
        primaryEntries.push(entry)
      }
      seenTerms.add(glossaryKey)
    }
  }

  return [...primaryEntries, ...secondaryEntries].slice(0, maxEntries)
}

function getQuotedSegments(text: string | undefined): string[] {
  if (!text) {
    return []
  }

  return [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter(Boolean)
}

function normalizeVocabularyDisplayText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return normalizeWhitespace(stripWrappingQuotes(value))
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^['"]+|['"]+$/g, '')
}

function normalizeVocabularyKey(word: string): string {
  return word
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
