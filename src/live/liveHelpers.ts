import type { LiveSessionStatus, LiveUtteranceState, WhisperHint } from './liveTypes'

export const livePauseThresholdMs = 1500

export function createEmptyLiveUtterance(): LiveUtteranceState {
  return {
    transcript: '',
    finalTranscript: '',
    finalTranscriptVersion: 0,
    hasEnglishSlip: false,
    pauseMs: 0,
    transcriptVersion: 0,
    analysisVersion: 0,
  }
}

export function formatWhisperBubbleText(hint: WhisperHint): string {
  const { englishText, spanishText } = getWhisperDisplayPair(hint)
  const betterSpanishPhrasing = normalizeSuggestedPhrase(hint.betterSpanishPhrasing, hint.spanishText)

  if (!betterSpanishPhrasing) {
    return `${englishText} = ${spanishText}`
  }

  return `${englishText} = ${spanishText}. Example: ${betterSpanishPhrasing}`
}

export function formatWhisperSpeechText(hint: WhisperHint): string {
  const { englishText, spanishText } = getWhisperDisplayPair(hint)
  const betterSpanishPhrasing = normalizeSuggestedPhrase(hint.betterSpanishPhrasing, hint.spanishText)

  if (!betterSpanishPhrasing) {
    return `${englishText} is ${spanishText}.`
  }

  return `${englishText} is ${spanishText}. In this sentence, you can say: ${betterSpanishPhrasing}`
}

export function repairTranscriptWithWhisperHint(
  transcript: string,
  hint: Pick<WhisperHint, 'englishText' | 'spanishText'> | null,
): string {
  if (!transcript || !hint) {
    return transcript
  }

  const englishText = normalizeWhitespace(hint.englishText)
  const spanishText = normalizeWhitespace(hint.spanishText)

  if (!englishText || !spanishText || normalizeComparable(englishText) === normalizeComparable(spanishText)) {
    return transcript
  }

  if (normalizeComparable(transcript).includes(normalizeComparable(englishText))) {
    return transcript
  }

  return replaceLastOccurrence(transcript, spanishText, englishText)
}

export function formatLiveTranscriptForComposer(
  transcript: string,
  hint: Pick<WhisperHint, 'englishText' | 'spanishText'> | null,
): string {
  return repairTranscriptWithWhisperHint(transcript, hint).replace(/[.!?]+$/g, '').trim()
}

export function inferOptimisticWhisperHint(input: {
  scenarioId: string | null
  transcript: string
}): Pick<WhisperHint, 'englishText' | 'spanishText'> | null {
  const transcript = normalizeWhitespace(input.transcript)

  if (!transcript) {
    return null
  }

  const icedMatch = transcript.match(/\biced\b/i)

  if (icedMatch) {
    return {
      englishText: icedMatch[0],
      spanishText: 'helado',
    }
  }

  if (input.scenarioId !== 'cafe-order' || !normalizeComparable(transcript).includes('cafe')) {
    return null
  }

  const trailingWordMatch = transcript.match(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)[.!?]*$/)

  if (!trailingWordMatch || normalizeComparable(trailingWordMatch[1]) !== 'helado') {
    return null
  }

  return {
    englishText: 'iced',
    spanishText: 'helado',
  }
}

export function getLiveHelperText(input: {
  errorMessage: string | null
  status: LiveSessionStatus
  utterance: LiveUtteranceState
}): string {
  if (input.errorMessage) {
    return input.errorMessage
  }

  switch (input.status) {
    case 'connecting':
      return 'Connecting to Nova Sonic...'
    case 'listening':
      return 'Listening...'
    case 'waiting_for_pause':
      return 'Send when you are ready.'
    case 'blocked_by_english':
      return 'Retry in Spanish, or send it for help.'
    case 'auto_submitting':
      return 'Sending your turn...'
    case 'cream_responding':
      return 'Cream is responding...'
    case 'error':
      return 'Live mode is unavailable right now.'
    case 'idle':
      return 'Speak live with Nova Sonic.'
    default:
      return 'Speak live with Nova Sonic.'
  }
}

function replaceLastOccurrence(source: string, search: string, replacement: string): string {
  const lowerSource = source.toLocaleLowerCase()
  const lowerSearch = search.toLocaleLowerCase()
  const matchIndex = lowerSource.lastIndexOf(lowerSearch)

  if (matchIndex === -1) {
    return source
  }

  return `${source.slice(0, matchIndex)}${replacement}${source.slice(matchIndex + search.length)}`
}

function normalizeComparable(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeSuggestedPhrase(value: string | undefined, spanishText: string): string | undefined {
  if (!value) {
    return undefined
  }

  const normalizedValue = normalizeWhitespace(value)

  if (!normalizedValue || normalizeComparable(normalizedValue) === normalizeComparable(spanishText)) {
    return undefined
  }

  return normalizedValue
}

function getWhisperDisplayPair(hint: Pick<WhisperHint, 'englishText' | 'spanishText'>): {
  englishText: string
  spanishText: string
} {
  if (isSandwichTranslationHint(hint)) {
    return {
      englishText: 'sandwich',
      spanishText: 'sándwich',
    }
  }

  return {
    englishText: hint.englishText,
    spanishText: hint.spanishText,
  }
}

function isSandwichTranslationHint(hint: Pick<WhisperHint, 'englishText' | 'spanishText'>): boolean {
  return normalizeComparable(hint.englishText).includes('sandwich') && normalizeComparable(hint.spanishText).includes('sandwich')
}
