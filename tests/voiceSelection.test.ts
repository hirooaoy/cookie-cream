import { describe, expect, it } from 'vitest'
import { selectPreferredVoice } from '../src/voiceSelection'

describe('selectPreferredVoice', () => {
  it('prefers a likely female Spanish voice for Cream', () => {
    const selectedVoice = selectPreferredVoice(
      [
        createVoice('Jorge', 'es-ES'),
        createVoice('Monica', 'es-MX'),
        createVoice('Daniel', 'en-US'),
      ],
      'Cream',
    )

    expect(selectedVoice?.name).toBe('Monica')
  })

  it('prefers a likely male English voice for Cookie', () => {
    const selectedVoice = selectPreferredVoice(
      [
        createVoice('Jenny', 'en-US'),
        createVoice('Daniel', 'en-GB'),
        createVoice('Monica', 'es-ES'),
      ],
      'Cookie',
    )

    expect(selectedVoice?.name).toBe('Daniel')
  })

  it('keeps language priority over persona when needed', () => {
    const selectedVoice = selectPreferredVoice(
      [
        createVoice('Jenny', 'en-US'),
        createVoice('Jorge', 'es-ES'),
      ],
      'Cookie',
    )

    expect(selectedVoice?.name).toBe('Jenny')
  })

  it('falls back to the best matching language when no persona hint exists', () => {
    const selectedVoice = selectPreferredVoice(
      [
        createVoice('Spanish Compact', 'es-MX'),
        createVoice('English Neutral', 'en-US'),
      ],
      'Cream',
    )

    expect(selectedVoice?.name).toBe('Spanish Compact')
  })
})

function createVoice(
  name: string,
  lang: string,
  options: Partial<Pick<SpeechSynthesisVoice, 'default' | 'localService' | 'voiceURI'>> = {},
): SpeechSynthesisVoice {
  return {
    default: options.default ?? false,
    lang,
    localService: options.localService ?? true,
    name,
    voiceURI: options.voiceURI ?? name,
  } as SpeechSynthesisVoice
}
