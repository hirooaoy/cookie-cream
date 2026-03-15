import { describe, expect, it } from 'vitest'
import { getScriptedTurnDecision } from '../src/demoScript'

describe('demo script overrides', () => {
  it('locks the cafe iced slip to the expected Cookie repair', () => {
    expect(
      getScriptedTurnDecision({
        transcript: 'a mi me da un café iced',
        phase: 'normal',
      }),
    ).toEqual({
      route: 'Cookie',
      reply: 'You\'re close. Instead of "iced", say: "A mí me da un café con hielo."',
      betterSpanishPhrasing: 'A mí me da un café con hielo.',
      englishSpans: ['iced'],
      vocabulary: [
        { term: 'café', translation: 'coffee' },
        { term: 'hielo', translation: 'ice' },
      ],
    })
  })

  it('gives the sandwich coaching beat in one short Cookie reply', () => {
    expect(
      getScriptedTurnDecision({
        transcript: 'Gracias. I want to add sandwich. How do I say sandwich again?',
        phase: 'normal',
      }),
    ).toEqual({
      route: 'Cookie',
      reply: 'sandwich = sándwich. Example: Quisiera añadir un sándwich, por favor.',
      betterSpanishPhrasing: 'Quisiera añadir un sándwich, por favor.',
      englishSpans: ['sandwich'],
      vocabulary: [{ term: 'sándwich', translation: 'sandwich' }],
    })
  })

  it('treats hola buenos dias as a cafe restart only inside the cafe scenario', () => {
    expect(
      getScriptedTurnDecision({
        transcript: 'Hola Buenos días.',
        phase: 'retry-after-cookie',
        scenarioId: 'cafe-order',
      }),
    ).toEqual({
      route: 'Cream',
      reply: 'Hola, buenos días. ¿Qué quieres pedir?',
    })
  })

  it('does not force the cafe restart outside the cafe scenario', () => {
    expect(
      getScriptedTurnDecision({
        transcript: 'Hola Buenos días.',
        phase: 'retry-after-cookie',
        scenarioId: null,
      }),
    ).toBeNull()
  })
})
