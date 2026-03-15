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

export function getSpeechTextSegments(
  message: Pick<Message, 'speaker' | 'text'>,
): MessageTextSegment[] {
  if (message.speaker === 'Cookie') {
    return mergeAdjacentSegments(splitCookieSpeechSegments(message.text))
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

function splitCookieSpeechSegments(text: string): MessageTextSegment[] {
  return text.split(/(".*?")/g).flatMap((part) => {
    if (!part) {
      return []
    }

    if (!/^".*"$/.test(part)) {
      return [{ isEnglish: true, text: part }]
    }

    const quotedText = part.slice(1, -1)

    if (!quotedText.trim()) {
      return [{ isEnglish: true, text: part }]
    }

    if (containsSpanish(quotedText) && !containsEnglish(quotedText)) {
      return [{ isEnglish: false, text: part }]
    }

    return [{ isEnglish: isEnglishPhrase(quotedText) || !containsSpanish(quotedText), text: part }]
  })
}

function mergeAdjacentSegments(segments: MessageTextSegment[]): MessageTextSegment[] {
  return segments.reduce<MessageTextSegment[]>((mergedSegments, segment) => {
    if (!segment.text) {
      return mergedSegments
    }

    const previousSegment = mergedSegments[mergedSegments.length - 1]

    if (previousSegment && previousSegment.isEnglish === segment.isEnglish) {
      previousSegment.text += segment.text
      return mergedSegments
    }

    mergedSegments.push({ ...segment })
    return mergedSegments
  }, [])
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
