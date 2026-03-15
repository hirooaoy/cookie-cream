import { describe, expect, it } from 'vitest'
import { buildLiveSonicSystemPrompt, buildLiveWhisperSystemPrompt } from '../server/liveSonicPrompt'

describe('liveSonicPrompt', () => {
  it('treats mixed-language verbatim capture as the expected behavior', () => {
    const prompt = buildLiveSonicSystemPrompt({
      learnerLanguage: 'English',
      targetLanguage: 'Spanish',
      scenarioId: null,
      recentMessages: [],
    })

    expect(prompt).toContain('Output a verbatim transcript, even when the learner mixes languages in one sentence.')
    expect(prompt).toContain('Only output English and Spanish words for this demo.')
    expect(prompt).toContain('Never replace an English word with a Spanish equivalent, even if the intended Spanish word seems obvious.')
    expect(prompt).toContain('Use Latin script only.')
    expect(prompt).toContain('Never output Korean, Japanese, Chinese, Cyrillic, or any other non-Latin script.')
    expect(prompt).toContain(
      'If the learner says "quiero un café iced", transcribe "quiero un café iced", not "quiero un café helado".',
    )
    expect(prompt).toContain('If the learner says "today fui al parque", transcribe "today fui al parque".')
    expect(prompt).toContain(
      'If the learner pauses to think and then adds one more word, continue the same transcript instead of rewriting earlier words.',
    )
    expect(prompt).toContain('Do not insert commas into the learner transcript.')
  })

  it('teaches whisper analysis how to recover a normalized trailing slip', () => {
    const prompt = buildLiveWhisperSystemPrompt({
      learnerLanguage: 'English',
      targetLanguage: 'Spanish',
      scenarioId: 'cafe-order',
      recentMessages: [],
    })

    expect(prompt).toContain('The user message is JSON with previousTranscript, currentTranscript, and newTrailingText.')
    expect(prompt).toContain(
      'Example: previousTranscript="quiero un café", currentTranscript="quiero un café helado", newTrailingText="helado" should return {"hasEnglishSlip":true,"englishText":"iced","spanishText":"helado","betterSpanishPhrasing":"A mí me da un café con hielo."}.',
    )
    expect(prompt).toContain(
      'Example: previousTranscript="gracias", currentTranscript="gracias i want to add sandwich how do i say sandwich again", newTrailingText="i want to add sandwich how do i say sandwich again" should return {"hasEnglishSlip":true,"englishText":"sandwich","spanishText":"sándwich","betterSpanishPhrasing":"Quisiera añadir un sándwich, por favor."}.',
    )
    expect(prompt).toContain('Use betterSpanishPhrasing for one short natural full-sentence retry in Spanish.')
    expect(prompt).toContain('Never return the same text for englishText and spanishText.')
  })
})
