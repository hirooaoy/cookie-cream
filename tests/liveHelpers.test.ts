import { describe, expect, it } from 'vitest'
import {
  createEmptyLiveUtterance,
  formatLiveTranscriptForComposer,
  formatWhisperBubbleText,
  formatWhisperSpeechText,
  getLiveHelperText,
  inferOptimisticWhisperHint,
  livePauseThresholdMs,
  repairTranscriptWithWhisperHint,
} from '../src/live/liveHelpers'

describe('live helper utilities', () => {
  it('formats the ephemeral whisper bubble copy with a full retry phrase when present', () => {
    expect(
      formatWhisperBubbleText({
        englishText: 'iced',
        spanishText: 'helado',
        betterSpanishPhrasing: 'A mí me da un café con hielo.',
        source: 'nova',
        createdAt: 0,
        version: 3,
      }),
    ).toBe('iced = helado. Example: A mí me da un café con hielo.')
  })

  it('formats Cookie whisper speech with both the translation and the retry phrase', () => {
    expect(
      formatWhisperSpeechText({
        englishText: 'iced',
        spanishText: 'helado',
        betterSpanishPhrasing: 'A mí me da un café con hielo.',
        source: 'nova',
        createdAt: 0,
        version: 3,
      }),
    ).toBe('iced is helado. In this sentence, you can say: A mí me da un café con hielo.')
  })

  it('collapses sandwich phrase hints down to the sandwich vocabulary pair', () => {
    expect(
      formatWhisperBubbleText({
        englishText: 'i want to add sandwich',
        spanishText: 'quiero añadir un sándwich',
        betterSpanishPhrasing: 'Quisiera añadir un sándwich, por favor.',
        source: 'nova',
        createdAt: 0,
        version: 4,
      }),
    ).toBe('sandwich = sándwich. Example: Quisiera añadir un sándwich, por favor.')

    expect(
      formatWhisperSpeechText({
        englishText: 'i want to add sandwich',
        spanishText: 'quiero añadir un sándwich',
        betterSpanishPhrasing: 'Quisiera añadir un sándwich, por favor.',
        source: 'nova',
        createdAt: 0,
        version: 4,
      }),
    ).toBe('sandwich is sándwich. In this sentence, you can say: Quisiera añadir un sándwich, por favor.')
  })

  it('returns a send prompt after live capture pauses', () => {
    expect(
      getLiveHelperText({
        errorMessage: null,
        status: 'waiting_for_pause',
        utterance: createEmptyLiveUtterance(),
      }),
    ).toBe('Send when you are ready.')
  })

  it('keeps the live pause threshold constant', () => {
    const utterance = {
      ...createEmptyLiveUtterance(),
      transcript: 'Quiero un café helado.',
      finalTranscript: 'Quiero un café helado.',
      finalTranscriptVersion: 5,
      transcriptVersion: 5,
      analysisVersion: 5,
      pauseMs: livePauseThresholdMs,
    }

    expect(utterance.pauseMs).toBe(livePauseThresholdMs)
  })

  it('repairs a normalized Spanish slip back to the likely spoken English word', () => {
    expect(
      repairTranscriptWithWhisperHint('Quiero un café helado.', {
        englishText: 'iced',
        spanishText: 'helado',
      }),
    ).toBe('Quiero un café iced.')
  })

  it('ignores whisper hints that repeat the same word on both sides', () => {
    expect(
      repairTranscriptWithWhisperHint('Quiero un café helado.', {
        englishText: 'helado',
        spanishText: 'helado',
      }),
    ).toBe('Quiero un café helado.')
  })

  it('removes trailing sentence punctuation from the live composer draft', () => {
    expect(
      formatLiveTranscriptForComposer('Quiero un café helado.', {
        englishText: 'iced',
        spanishText: 'helado',
      }),
    ).toBe('Quiero un café iced')

    expect(formatLiveTranscriptForComposer('Hola!', null)).toBe('Hola')
  })

  it('infers the likely iced slip before whisper analysis completes', () => {
    expect(
      inferOptimisticWhisperHint({
        scenarioId: 'cafe-order',
        transcript: 'A mí me da un café helado.',
      }),
    ).toEqual({
      englishText: 'iced',
      spanishText: 'helado',
    })

    expect(
      inferOptimisticWhisperHint({
        scenarioId: 'cafe-order',
        transcript: 'A mí me da un café iced.',
      }),
    ).toEqual({
      englishText: 'iced',
      spanishText: 'helado',
    })

    expect(
      inferOptimisticWhisperHint({
        scenarioId: 'cafe-order',
        transcript: 'A mí me da un café con hielo.',
      }),
    ).toBeNull()
  })
})
