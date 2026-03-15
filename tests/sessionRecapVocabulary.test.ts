import { describe, expect, it } from 'vitest'
import { resolveLocalSessionRecap } from '../src/recapApi'
import { buildSessionRecapPresentation } from '../src/recapPresentation'
import { initialConversation, submitUserTurn } from '../src/prototype'

describe('session recap vocabulary', () => {
  it('keeps sandwich in the cafe demo recap alongside cafe and hielo', () => {
    let state = initialConversation

    for (const turn of [
      'a mi me da un café iced',
      'a mi me da un café con hielo porfa',
      'Gracias. I want to add sandwich. How do I say sandwich again?',
      'Hola Buenos días.',
    ]) {
      state = submitUserTurn(state, turn, { scenarioId: 'cafe-order' })
    }

    const recap = resolveLocalSessionRecap({
      recentMessages: state.messages,
      learnerLanguage: 'English',
      targetLanguage: 'Spanish',
    }).recap
    const presentation = buildSessionRecapPresentation(recap, state.messages)

    expect(presentation.vocabulary).toEqual(
      expect.arrayContaining([
        { term: 'café', translation: 'coffee' },
        { term: 'hielo', translation: 'ice' },
        { term: 'sándwich', translation: 'sandwich' },
      ]),
    )
  })
})
