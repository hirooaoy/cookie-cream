import { describe, expect, it } from 'vitest'
import type { TurnRequest } from '../src/turnApi'
import { __testables } from '../server/novaTextTurn'

const baseRequest: TurnRequest = {
  transcript: 'Today was very hot',
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

describe('novaTextTurn helpers', () => {
  it('extracts text from a converse response', () => {
    const text = __testables.extractConverseText({
      output: {
        message: {
          role: 'assistant',
          content: [
            {
              text: '{"route":"Cookie","reply":"Nice try. In Spanish you can say: \\"Hoy hizo mucho calor.\\" Try again.","betterSpanishPhrasing":"Hoy hizo mucho calor."}',
            },
          ],
        },
      },
    })

    expect(text).toContain('"route":"Cookie"')
  })

  it('builds a system prompt with the current turn context', () => {
    const prompt = __testables.buildSystemPrompt(baseRequest, 'Cookie')

    expect(prompt).toContain('Current phase: normal.')
    expect(prompt).toContain('Recent messages:')
    expect(prompt).toContain('Cream: ¿Qué hiciste hoy?')
    expect(prompt).toContain('Return strict JSON only.')
    expect(prompt).toContain('Do not output markdown.')
    expect(prompt).toContain('Do not output code fences.')
    expect(prompt).toContain('The route for this turn is fixed to Cookie.')
    expect(prompt).toContain('containsEnglish')
    expect(prompt).toContain('englishSpans')
    expect(prompt).toContain('vocabulary')
    expect(prompt).toContain('Grocery Store')
    expect(prompt).toContain('Cookie should sound like a coach, not a chat partner.')
    expect(prompt).toContain('Cookie should adapt its wording to the mistake type instead of repeating one fixed script.')
    expect(prompt).toContain('If the learner stayed fully in English, Cookie should say that clearly and then give the Spanish version.')
    expect(prompt).toContain('Cream must speak in Spanish only.')
  })

  it('standardizes Cookie replies into the short demo-ready format', () => {
    expect(
      __testables.createCookieReply(baseRequest, {
        route: 'Cookie',
        betterSpanishPhrasing: 'Quiero un café con leche y un muffin.',
        reply: 'Longer model text that should not leak through.',
      }),
    ).toBe('You stayed in English there. Try: "Quiero un café con leche y un muffin."')
  })

  it('uses the scripted sandwich coaching reply for the demo turn', () => {
    expect(
      __testables.createAssistantReply(
        {
          ...baseRequest,
          transcript: 'Gracias. I want to add sandwich. How do I say sandwich again?',
        },
        {
          route: 'Cookie',
          betterSpanishPhrasing: 'Quisiera añadir un sándwich, por favor.',
          reply: 'Model wording that should not leak through.',
        },
      ),
    ).toBe(
      'sandwich = sándwich. Example: Quisiera añadir un sándwich, por favor.',
    )
  })

  it('uses the scripted greeting restart for Cream', () => {
    expect(
      __testables.createAssistantReply(
        {
          ...baseRequest,
          phase: 'retry-after-cookie',
          scenarioId: 'cafe-order',
          transcript: 'Hola Buenos días.',
        },
        {
          route: 'Cream',
          reply: 'Model wording that should not leak through.',
        },
      ),
    ).toBe('Hola, buenos días. ¿Qué quieres pedir?')
  })

  it('does not force the cafe greeting after a reset with no active scenario', () => {
    expect(
      __testables.createAssistantReply(
        {
          ...baseRequest,
          phase: 'retry-after-cookie',
          scenarioId: null,
          transcript: 'Hola Buenos días.',
        },
        {
          route: 'Cream',
          reply: 'Hola, buenos días. ¿Cómo estás?',
        },
      ),
    ).toBe('Hola, buenos días. ¿Cómo estás?')
  })

  it('marks Cream as invalid when the transcript still contains English', () => {
    const validation = __testables.validateDecision(baseRequest, {
      route: 'Cream',
      reply: 'Ah, sí. ¿Qué hiciste después?',
    }, 'Cookie')

    expect(validation).toEqual({
      expectedRoute: 'Cookie',
      reason: 'The learner transcript clearly maps to Cookie, so the route must be Cookie.',
    })
  })

  it('infers Cream for obvious Spanish-only turns', () => {
    expect(
      __testables.inferExpectedRoute({
        ...baseRequest,
        transcript: 'Fui al parque con mis amigos',
      }),
    ).toBe('Cream')
  })

  it('infers Cookie for mixed turns with common English connectors and learner mistakes', () => {
    expect(
      __testables.inferExpectedRoute({
        ...baseRequest,
        transcript: 'Hoy fui al parque and then fui a casa',
      }),
    ).toBe('Cookie')

    expect(
      __testables.inferExpectedRoute({
        ...baseRequest,
        transcript: 'Yo eated tacos',
      }),
    ).toBe('Cookie')

    expect(
      __testables.inferExpectedRoute({
        ...baseRequest,
        transcript: 'Hoy fui a Grocery Store',
      }),
    ).toBe('Cookie')
  })

  it('parses model-reported English spans from the decision payload', () => {
    const decision = __testables.parseNovaDecision(
      '{"route":"Cookie","containsEnglish":true,"englishSpans":["Grocery Store"],"betterSpanishPhrasing":"Hoy fui al supermercado.","vocabulary":[{"term":"supermercado","translation":"grocery store"}],"reply":"You\'re close. \\"Grocery Store\\" should be Spanish here. Say: \\"Hoy fui al supermercado.\\""}',
    )

    expect(decision).toMatchObject({
      route: 'Cookie',
      containsEnglish: true,
      englishSpans: ['Grocery Store'],
      betterSpanishPhrasing: 'Hoy fui al supermercado.',
      vocabulary: [{ term: 'supermercado', translation: 'grocery store' }],
    })
  })

  it('attaches structured vocabulary to Cookie turn responses', () => {
    const response = __testables.createNovaTurnResponse(
      baseRequest,
      {
        route: 'Cookie',
        betterSpanishPhrasing: 'Hoy hizo mucho calor.',
        vocabulary: [{ term: 'calor', translation: 'heat' }],
        reply: 'That was all English. In Spanish, say: "Hoy hizo mucho calor." Try again.',
      },
      'us.amazon.nova-2-lite-v1:0',
    )

    expect(response.messages[1]).toMatchObject({
      speaker: 'Cookie',
      vocabulary: [{ term: 'calor', translation: 'heat' }],
    })
  })

  it('rejects Cookie replies that continue the conversation topic', () => {
    const validation = __testables.validateDecision(baseRequest, {
      route: 'Cookie',
      betterSpanishPhrasing: 'Hoy hizo mucho calor.',
      reply: 'Nice try. In Spanish you can say: "Hoy hizo mucho calor." ¿Qué hiciste después?',
    }, 'Cookie')

    expect(validation).toEqual({
      expectedRoute: 'Cookie',
      reason: 'Cookie must coach and ask for a retry, not continue the conversation topic.',
    })
  })

  it('rejects Cookie replies that are too long', () => {
    expect(
      __testables.isCookieReplyTooLong(
        'Nice try. Say: "Hoy hizo mucho calor." Try again in Spanish and remember the grammar rule because this verb form changes with the tense.',
      ),
    ).toBe(true)
  })

  it('rejects Cookie replies that drift into grammar teaching', () => {
    const validation = __testables.validateDecision(baseRequest, {
      route: 'Cookie',
      betterSpanishPhrasing: 'Hoy hizo mucho calor.',
      reply: 'Nice try. Say: "Hoy hizo mucho calor." Better because the tense matches. Try again in Spanish.',
    }, 'Cookie')

    expect(validation).toEqual({
      expectedRoute: 'Cookie',
      reason: 'Cookie coaching must avoid grammar lectures and long teaching notes.',
    })
  })

  it('rejects Cream replies that switch into English', () => {
    const validation = __testables.validateDecision({
      ...baseRequest,
      transcript: 'Fui al parque con mis amigos',
    }, {
      route: 'Cream',
      reply: 'That sounds fun. What did you do next?',
    }, 'Cream')

    expect(validation).toEqual({
      expectedRoute: 'Cream',
      reason: 'Cream reply must stay in Spanish.',
    })
  })

  it('rejects Cream when the model itself flags an English phrase in the learner transcript', () => {
    const validation = __testables.validateDecision({
      ...baseRequest,
      transcript: 'Hoy fui a Grocery Store',
    }, {
      route: 'Cream',
      containsEnglish: true,
      englishSpans: ['Grocery Store'],
      reply: 'Ah, sí. ¿Qué compraste?',
    }, null)

    expect(validation).toEqual({
      expectedRoute: 'Cookie',
      reason: 'The learner transcript still contains English, so Cookie must respond.',
    })
  })
})
