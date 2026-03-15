export type BrowserSpeechRecognitionAlternative = {
  transcript: string
  confidence: number
}

export type BrowserSpeechRecognitionResult =
  ArrayLike<BrowserSpeechRecognitionAlternative> & {
    isFinal: boolean
  }

export type BrowserSpeechRecognitionResultList = ArrayLike<BrowserSpeechRecognitionResult>

export type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number
  results: BrowserSpeechRecognitionResultList
}

export type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string
  message: string
}

export type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((event: Event) => void) | null
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: ((event: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

export type SpeechTranscriptSnapshot = {
  finalizedText: string
  interimText: string
  transcriptText: string
}

// Browser SpeechRecognition is demo-grade only. It is browser-dependent, uses a
// single recognition locale at a time, and should not drive Cookie/Cream routing
// from recognition metadata. Routing should happen only after the learner reviews
// the transcript text and presses Send.
export const browserSpeechConfig = {
  intendedDemoLanguages: ['English', 'Spanish'] as const,
  recognitionLocale: 'es-ES',
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

export function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function createSpeechRecognition(
): BrowserSpeechRecognition | null {
  const SpeechRecognitionConstructor = getSpeechRecognitionConstructor()

  if (!SpeechRecognitionConstructor) {
    return null
  }

  const recognition = new SpeechRecognitionConstructor()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = browserSpeechConfig.recognitionLocale

  return recognition
}

export function extractSpeechTranscript(
  event: BrowserSpeechRecognitionEvent,
  previousFinalizedText = '',
): SpeechTranscriptSnapshot {
  let finalizedText = previousFinalizedText
  let interimText = ''

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index]
    const segment = sanitizeRecognizedSegment(result?.[0]?.transcript ?? '')

    if (!segment) {
      continue
    }

    if (result.isFinal) {
      finalizedText = [finalizedText, segment].filter(Boolean).join(' ').trim()
    } else {
      interimText = [interimText, segment].filter(Boolean).join(' ').trim()
    }
  }

  return {
    finalizedText,
    interimText,
    transcriptText: [finalizedText, interimText].filter(Boolean).join(' ').trim(),
  }
}

function sanitizeRecognizedSegment(value: string): string {
  return value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
}

export function getSpeechRecognitionErrorMessage(error: string): string {
  switch (error) {
    case 'audio-capture':
      return 'No microphone was found.'
    case 'network':
      return 'Speech recognition is unavailable right now.'
    case 'no-speech':
      return 'No speech detected. Try again.'
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked.'
    default:
      return 'Speech recognition failed. Try again.'
  }
}
