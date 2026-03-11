import { describe, expect, it } from 'vitest'
import type { TurnRequest } from '../src/turnApi'
import { __testables } from '../server/novaTurn'

const baseRequest: TurnRequest = {
  transcript: 'Hoy fui al parque',
  phase: 'normal',
  recentMessages: [
    {
      id: 'cream-1',
      speaker: 'Cream',
      text: '¿Qué hiciste hoy?',
    },
  ],
  learnerLanguage: 'English',
  targetLanguage: 'Spanish',
}

describe('novaTurn shaping', () => {
  it('parses betterSpanishPhrasing when Nova includes it', () => {
    const decision = __testables.parseNovaDecision(
      '{"route":"Cookie","betterSpanishPhrasing":"Hoy hizo mucho calor.","reply":"Nice try. In Spanish you can say: \\"Hoy hizo mucho calor.\\" Try again."}',
    )

    expect(decision).toEqual({
      route: 'Cookie',
      betterSpanishPhrasing: 'Hoy hizo mucho calor.',
      reply: 'Nice try. In Spanish you can say: "Hoy hizo mucho calor." Try again.',
    })
  })

  it('standardizes Cookie replies around one better Spanish phrasing', () => {
    const normalizedDecision = __testables.normalizeNovaDecision({
      route: 'Cookie',
      betterSpanishPhrasing: ' "Hoy hizo mucho calor." ',
      reply: 'Longer model text that should not leak through.',
    })
    const reply = __testables.createAssistantReply(baseRequest, normalizedDecision)

    expect(reply).toBe('You\'re close. Say: "Hoy hizo mucho calor."')
  })

  it('rejects Cream replies that drift into Cookie coaching', () => {
    expect(() =>
      __testables.createAssistantReply(baseRequest, {
        route: 'Cream',
        reply: 'Nice try. In Spanish you can say: "Hoy hizo mucho calor." Try again.',
      }),
    ).toThrow('Cookie coaching style')
  })

  it('marks Cream as invalid when the transcript still contains obvious English', () => {
    const validation = __testables.validateDecision(
      {
        ...baseRequest,
        phase: 'retry-after-cookie',
        transcript: 'test',
      },
      {
        route: 'Cream',
        reply: 'Ah, sí. ¿Qué hiciste después?',
      },
    )

    expect(validation).toEqual({
      expectedRoute: 'Cookie',
      reason: 'The learner transcript still contains English, so Cookie must respond.',
    })
  })

  it('marks Cookie as invalid when the better Spanish phrasing is missing', () => {
    const validation = __testables.validateDecision(baseRequest, {
      route: 'Cookie',
      reply: 'Nice try. Try again.',
    })

    expect(validation).toEqual({
      expectedRoute: 'Cookie',
      reason: 'Cookie must include one better Spanish phrasing.',
    })
  })

  it('builds the documented Sonic text-input event sequence', () => {
    const events = __testables.buildSonicEvents({
      promptName: 'turn-1',
      systemContentName: 'system-1',
      userContentName: 'user-1',
      systemPrompt: 'System prompt.',
      reviewedTranscript: 'Today was very hot',
      config: {
        enabled: true,
        region: 'us-east-1',
        sonicModelId: 'amazon.nova-2-sonic-v1:0',
        textModelId: 'us.amazon.nova-2-lite-v1:0',
        voiceId: 'matthew',
      },
    })

    expect(events).toHaveLength(10)
    expect(events.map((event) => Object.keys(event.event)[0])).toEqual([
      'sessionStart',
      'promptStart',
      'contentStart',
      'textInput',
      'contentEnd',
      'contentStart',
      'textInput',
      'contentEnd',
      'promptEnd',
      'sessionEnd',
    ])

    expect(events[2]).toEqual({
      event: {
        contentStart: {
          promptName: 'turn-1',
          contentName: 'system-1',
          type: 'TEXT',
          interactive: false,
          role: 'SYSTEM',
          textInputConfiguration: {
            mediaType: 'text/plain',
          },
        },
      },
    })

    expect(events[5]).toEqual({
      event: {
        contentStart: {
          promptName: 'turn-1',
          contentName: 'user-1',
          type: 'TEXT',
          interactive: true,
          role: 'USER',
          textInputConfiguration: {
            mediaType: 'text/plain',
          },
        },
      },
    })

    expect(events[6]).toEqual({
      event: {
        textInput: {
          promptName: 'turn-1',
          contentName: 'user-1',
          content: 'Today was very hot',
        },
      },
    })
  })
})
