import { describe, expect, it } from 'vitest'
import { __testables } from '../server/liveSonicSession'

describe('liveSonicSession helpers', () => {
  it('merges overlapping transcript updates into one utterance', () => {
    expect(__testables.mergeTranscriptProgress('Quiero un café', 'café helado')).toBe(
      'Quiero un café helado',
    )

    expect(__testables.mergeTranscriptProgress('Quiero un café', 'Quiero un café helado')).toBe(
      'Quiero un café helado',
    )

    expect(__testables.mergeTranscriptProgress('Quiero un café', 'iced')).toBe(
      'Quiero un café iced',
    )

    expect(__testables.mergeTranscriptProgress('A mí me da un café.', 'iced')).toBe(
      'A mí me da un café iced',
    )
  })

  it('extracts the new trailing phrase for whisper repair analysis', () => {
    expect(__testables.extractTrailingTranscript('Quiero un café', 'Quiero un café helado')).toBe(
      'helado',
    )

    expect(__testables.extractTrailingTranscript('', 'Quiero un café iced')).toBe(
      'Quiero un café iced',
    )
  })

  it('strips non-Latin scripts from the live transcript', () => {
    expect(__testables.sanitizeTranscriptForSupportedLanguages('hola 안녕하세요 iced')).toBe(
      'hola iced',
    )

    expect(__testables.sanitizeTranscriptForSupportedLanguages('quiero un café 한국어 por favor')).toBe(
      'quiero un café por favor',
    )

    expect(__testables.sanitizeTranscriptForSupportedLanguages('a mi, me da un café, iced')).toBe(
      'a mi me da un café iced',
    )
  })

  it('parses strict whisper analysis payloads', () => {
    expect(__testables.parseWhisperAnalysis('{"hasEnglishSlip":false}')).toEqual({
      hasEnglishSlip: false,
    })

    expect(
      __testables.parseWhisperAnalysis(
        '{"hasEnglishSlip":true,"englishText":"iced","spanishText":"helado","betterSpanishPhrasing":"A mí me da un café con hielo"}',
      ),
    ).toEqual({
      hasEnglishSlip: true,
      englishText: 'iced',
      spanishText: 'helado',
      betterSpanishPhrasing: 'A mí me da un café con hielo.',
    })

    expect(
      __testables.parseWhisperAnalysis('{"hasEnglishSlip":true,"englishText":"","spanishText":"helado"}'),
    ).toEqual({
      hasEnglishSlip: false,
    })

    expect(
      __testables.parseWhisperAnalysis(
        '{"hasEnglishSlip":true,"englishText":"helado","spanishText":"helado"}',
      ),
    ).toEqual({
      hasEnglishSlip: false,
    })
  })

  it('detects explicit iced slips without relying on model inference', () => {
    expect(
      __testables.getDeterministicWhisperAnalysis({
        liveInput: {
          learnerLanguage: 'English',
          targetLanguage: 'Spanish',
          scenarioId: 'cafe-order',
          recentMessages: [],
        },
        previousTranscript: 'A mí me da un café',
        transcript: 'A mí me da un café iced',
      }),
    ).toEqual({
      hasEnglishSlip: true,
      englishText: 'iced',
      spanishText: 'helado',
      betterSpanishPhrasing: 'A mí me da un café con hielo.',
    })
  })

  it('detects the sandwich help turn as a one-word vocabulary correction', () => {
    expect(
      __testables.getDeterministicWhisperAnalysis({
        liveInput: {
          learnerLanguage: 'English',
          targetLanguage: 'Spanish',
          scenarioId: 'cafe-order',
          recentMessages: [],
        },
        previousTranscript: 'Gracias',
        transcript: 'Gracias I want to add sandwich how do I say sandwich again',
      }),
    ).toEqual({
      hasEnglishSlip: true,
      englishText: 'sandwich',
      spanishText: 'sándwich',
      betterSpanishPhrasing: 'Quisiera añadir un sándwich, por favor.',
    })
  })

  it('does not flag natural Spanish cafe phrasing as an English slip', () => {
    expect(
      __testables.getDeterministicWhisperAnalysis({
        liveInput: {
          learnerLanguage: 'English',
          targetLanguage: 'Spanish',
          scenarioId: 'cafe-order',
          recentMessages: [],
        },
        previousTranscript: 'A mí me da un café',
        transcript: 'A mí me da un café con hielo',
      }),
    ).toBeNull()
  })

  it('detects normalized helado after a cafe pause as the likely iced slip', () => {
    expect(
      __testables.getDeterministicWhisperAnalysis({
        liveInput: {
          learnerLanguage: 'English',
          targetLanguage: 'Spanish',
          scenarioId: 'cafe-order',
          recentMessages: [],
        },
        previousTranscript: 'A mí me da un café',
        transcript: 'A mí me da un café helado',
      }),
    ).toEqual({
      hasEnglishSlip: true,
      englishText: 'iced',
      spanishText: 'helado',
      betterSpanishPhrasing: 'A mí me da un café con hielo.',
    })
  })

  it('detects normalized helado with terminal punctuation after a cafe pause', () => {
    expect(
      __testables.getDeterministicWhisperAnalysis({
        liveInput: {
          learnerLanguage: 'English',
          targetLanguage: 'Spanish',
          scenarioId: 'cafe-order',
          recentMessages: [],
        },
        previousTranscript: 'A mí me da un café',
        transcript: 'A mí me da un café helado.',
      }),
    ).toEqual({
      hasEnglishSlip: true,
      englishText: 'iced',
      spanishText: 'helado',
      betterSpanishPhrasing: 'A mí me da un café con hielo.',
    })
  })

  it('keeps the existing whisper analysis when only punctuation changes', () => {
    expect(
      __testables.shouldRunWhisperAnalysis('A mí me da un café helado.', 'A mí me da un café helado'),
    ).toBe(false)

    expect(
      __testables.shouldRunWhisperAnalysis('A mí me da un café iced?', 'A mí me da un café iced'),
    ).toBe(false)

    expect(
      __testables.shouldRunWhisperAnalysis('A mí me da un café helado', 'A mí me da un café'),
    ).toBe(true)
  })
})
