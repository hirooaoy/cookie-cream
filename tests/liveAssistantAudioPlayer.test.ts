import { describe, expect, it } from 'vitest'
import { parseAssistantAudioStreamEvent } from '../src/live/liveAssistantAudioPlayer'

describe('liveAssistantAudioPlayer stream parsing', () => {
  it('parses assistant audio lifecycle and chunk events', () => {
    expect(
      parseAssistantAudioStreamEvent(
        JSON.stringify({
          type: 'audio_start',
          sampleRateHertz: 24000,
          speaker: 'Cream',
        }),
      ),
    ).toEqual({
      type: 'audio_start',
      sampleRateHertz: 24000,
      speaker: 'Cream',
    })

    expect(
      parseAssistantAudioStreamEvent(
        JSON.stringify({
          type: 'audio_chunk',
          audioBase64: 'Zm9v',
        }),
      ),
    ).toEqual({
      type: 'audio_chunk',
      audioBase64: 'Zm9v',
    })

    expect(
      parseAssistantAudioStreamEvent(
        JSON.stringify({
          type: 'audio_end',
          speaker: 'Cookie',
        }),
      ),
    ).toEqual({
      type: 'audio_end',
      speaker: 'Cookie',
    })
  })

  it('rejects invalid stream payloads', () => {
    expect(parseAssistantAudioStreamEvent('not-json')).toBeNull()
    expect(parseAssistantAudioStreamEvent(JSON.stringify({ type: 'audio_start', speaker: 'Cream' }))).toBeNull()
  })
})
