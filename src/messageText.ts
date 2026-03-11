import { containsAllowedProperNoun, containsEnglish, containsSpanish, type Message } from './prototype'

export type MessageTextSegment = {
  isEnglish: boolean
  text: string
}

export function getBubbleTextSegments(
  message: Pick<Message, 'speaker' | 'text'>,
): MessageTextSegment[] {
  if (message.speaker === 'User') {
    return splitEnglishTokenSegments(message.text)
  }

  if (message.speaker === 'Cookie') {
    return splitQuotedEnglishSegments(message.text)
  }

  return [{ isEnglish: false, text: message.text }]
}

export function getInlineQuoteTextSegments(text: string): MessageTextSegment[] {
  return splitEnglishTokenSegments(text)
}

function splitEnglishTokenSegments(text: string): MessageTextSegment[] {
  return text.split(/(\s+)/).map((part) => ({
    isEnglish: isEnglishToken(part),
    text: part,
  }))
}

function splitQuotedEnglishSegments(text: string): MessageTextSegment[] {
  return text.split(/(".*?")/g).flatMap((part) => {
    if (!part) {
      return []
    }

    if (!/^".*"$/.test(part)) {
      return [{ isEnglish: false, text: part }]
    }

    const quotedText = part.slice(1, -1)

    if (!isEnglishPhrase(quotedText)) {
      return [{ isEnglish: false, text: part }]
    }

    return [
      { isEnglish: false, text: '"' },
      { isEnglish: true, text: quotedText },
      { isEnglish: false, text: '"' },
    ]
  })
}

function isEnglishPhrase(text: string): boolean {
  if (containsSpanish(text)) {
    return false
  }

  const tokens = text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+/g) ?? []

  return tokens.some((token) => isKnownEnglishToken(token) || isCamelCaseEnglishToken(token))
}

function isEnglishToken(part: string): boolean {
  const normalizedWord = normalizeDisplayWord(part)

  if (!normalizedWord) {
    return false
  }

  return isKnownEnglishToken(normalizedWord) || isCamelCaseEnglishToken(normalizedWord)
}

function isKnownEnglishToken(word: string): boolean {
  return containsEnglish(word) && !containsSpanish(word)
}

function isCamelCaseEnglishToken(word: string): boolean {
  return /[a-z][A-Z]/.test(word) && !containsAllowedProperNoun(word)
}

function normalizeDisplayWord(part: string): string {
  return part
    .replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+/, '')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+$/, '')
}
