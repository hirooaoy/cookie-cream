import { describe, expect, it } from 'vitest'
import { __testables } from '../server/assistantAudioService'

describe('assistantAudioService helpers', () => {
  it('builds a strict speak-exactly system prompt', () => {
    expect(
      __testables.buildAssistantAudioSystemPrompt({
        learnerLanguage: 'English',
        speaker: 'Cream',
        targetLanguage: 'Spanish',
        text: 'Hola. ¿Qué quieres pedir?',
      }),
    ).toContain('Speak the next USER text exactly as written.')
  })

  it('parses assistant audio payloads', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        event: {
          audioOutput: {
            content: 'Zm9v',
          },
        },
      }),
    )

    expect(__testables.parseAssistantAudioPayload(bytes)).toEqual({
      event: {
        audioOutput: {
          content: 'Zm9v',
        },
      },
    })
  })
})
