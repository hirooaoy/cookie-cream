import type { Phase, UserTarget } from './prototype.js'
import type { VocabularyEntry } from './vocabulary.js'

export type ScriptedTurnDecision = {
  route: UserTarget
  reply: string
  betterSpanishPhrasing?: string
  englishSpans?: string[]
  vocabulary?: VocabularyEntry[]
}

type ScriptedTurnInput = {
  phase: Phase
  scenarioId?: string | null
  transcript: string
}

export function getScriptedTurnDecision(input: ScriptedTurnInput): ScriptedTurnDecision | null {
  const normalizedTranscript = normalizeComparable(input.transcript)

  if (isCafeIcedSlip(normalizedTranscript)) {
    return {
      route: 'Cookie',
      reply: 'You\'re close. Instead of "iced", say: "A mí me da un café con hielo."',
      betterSpanishPhrasing: 'A mí me da un café con hielo.',
      englishSpans: ['iced'],
      vocabulary: [
        { term: 'café', translation: 'coffee' },
        { term: 'hielo', translation: 'ice' },
      ],
    }
  }

  if (isCafeOrderRetry(normalizedTranscript)) {
    return {
      route: 'Cream',
      reply: 'Claro. ¿Quieres algo más?',
    }
  }

  if (isSandwichHelpTurn(normalizedTranscript)) {
    return {
      route: 'Cookie',
      reply: 'sandwich = sándwich. Example: Quisiera añadir un sándwich, por favor.',
      betterSpanishPhrasing: 'Quisiera añadir un sándwich, por favor.',
      englishSpans: ['sandwich'],
      vocabulary: [{ term: 'sándwich', translation: 'sandwich' }],
    }
  }

  if (input.scenarioId === 'cafe-order' && isFreshGreeting(normalizedTranscript)) {
    return {
      route: 'Cream',
      reply: 'Hola, buenos días. ¿Qué quieres pedir?',
    }
  }

  return null
}

function isCafeIcedSlip(transcript: string): boolean {
  return /\bcafe\b/.test(transcript) && /\biced\b/.test(transcript)
}

function isCafeOrderRetry(transcript: string): boolean {
  return /\bcafe\b/.test(transcript) && /\bcon hielo\b/.test(transcript) && !/\biced\b/.test(transcript)
}

function isSandwichHelpTurn(transcript: string): boolean {
  return transcript.includes('sandwich') && (transcript.includes('how do i say') || transcript.includes('i want to add'))
}

function isFreshGreeting(transcript: string): boolean {
  return transcript === 'hola buenos dias' || transcript.startsWith('hola buenos dias ')
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
