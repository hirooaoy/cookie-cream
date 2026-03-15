import { describe, expect, it } from 'vitest'
import {
  initialConversation,
  submitUserTurn,
  type ConversationState,
  type Message,
} from '../src/prototype'

describe('submitUserTurn', () => {
  it('starts with an empty conversation until a scenario is chosen or the user sends a turn', () => {
    expect(initialConversation).toEqual({
      phase: 'normal',
      messages: [],
    })
  })

  it('routes Spanish-only input to Cream', () => {
    const nextState = submitUserTurn(initialConversation, 'Hoy fui al parque')

    expect(nextState.phase).toBe('normal')
    expect(getNewMessages(nextState)).toEqual([
      {
        speaker: 'User',
        target: 'Cream',
        text: 'Hoy fui al parque',
      },
      {
        speaker: 'Cream',
        target: undefined,
        text: 'Entiendo. Cuéntame un poco más.',
      },
    ])
  })

  it('routes English-only input to Cookie', () => {
    const nextState = submitUserTurn(initialConversation, 'Today was very hot')

    expect(nextState.phase).toBe('retry-after-cookie')
    expect(getNewMessages(nextState)).toEqual([
      {
        speaker: 'User',
        target: 'Cookie',
        text: 'Today was very hot',
      },
      {
        speaker: 'Cookie',
        target: undefined,
        text: 'You stayed in English there. Try: "Hoy hizo mucho calor."',
      },
    ])

    expect(getLatestMessage(nextState)).toMatchObject({
      speaker: 'Cookie',
      vocabulary: [
        { term: 'calor', translation: 'heat' },
        { term: 'hoy', translation: 'today' },
      ],
    })
  })

  it('routes mixed Spanish and English input to Cookie', () => {
    const nextState = submitUserTurn(initialConversation, 'Hoy fue very hot')

    expect(nextState.phase).toBe('retry-after-cookie')
    expect(getNewMessages(nextState)).toEqual([
      {
        speaker: 'User',
        target: 'Cookie',
        text: 'Hoy fue very hot',
      },
      {
        speaker: 'Cookie',
        target: undefined,
        text: 'You\'re close. Use "mucho calor" instead of "very hot". Say: "Hoy hizo mucho calor."',
      },
    ])
  })

  it('routes common mixed connectors and learner mistakes to Cookie', () => {
    const connectorState = submitUserTurn(initialConversation, 'Hoy fui al parque and then fui a casa')
    const mistakeState = submitUserTurn(initialConversation, 'Yo eated tacos')
    const venueState = submitUserTurn(initialConversation, 'Hoy fui a Grocery Store')
    const greetingState = submitUserTurn(initialConversation, 'Hola cool')

    expect(connectorState.phase).toBe('retry-after-cookie')
    expect(getLatestMessage(connectorState)).toMatchObject({
      speaker: 'Cookie',
      text: 'You\'re close. Keep the whole sentence in Spanish and try again.',
    })

    expect(mistakeState.phase).toBe('retry-after-cookie')
    expect(getLatestMessage(mistakeState).speaker).toBe('Cookie')
    expect(getLatestMessage(mistakeState).text).toMatch(/Spanish/)

    expect(venueState.phase).toBe('retry-after-cookie')
    expect(getLatestMessage(venueState)).toMatchObject({
      speaker: 'Cookie',
    })
    expect(getLatestMessage(venueState).text).toMatch(/Spanish/)

    expect(greetingState.phase).toBe('retry-after-cookie')
    expect(getLatestMessage(greetingState)).toMatchObject({
      speaker: 'Cookie',
    })
  })

  it("keeps McDonald's and YouTube examples with Cream", () => {
    const mcdonaldsState = submitUserTurn(initialConversation, "Hoy fui a McDonald's")
    const youtubeState = submitUserTurn(initialConversation, 'Hoy vi YouTube')

    expect(mcdonaldsState.phase).toBe('normal')
    expect(getLatestMessage(mcdonaldsState)).toMatchObject({
      speaker: 'Cream',
      text: 'Entiendo. Cuéntame un poco más.',
    })

    expect(youtubeState.phase).toBe('normal')
    expect(getLatestMessage(youtubeState)).toMatchObject({
      speaker: 'Cream',
      text: 'Entiendo. Cuéntame un poco más.',
    })
  })

  it('returns to Cream after a Spanish-only retry', () => {
    const cookieState = submitUserTurn(initialConversation, 'Today was very hot')
    const retryState = submitUserTurn(cookieState, 'Hoy hizo mucho calor.')

    expect(retryState.phase).toBe('normal')
    expect(getNewMessages(retryState, cookieState.messages.length)).toEqual([
      {
        speaker: 'User',
        target: 'Cream',
        text: 'Hoy hizo mucho calor.',
      },
      {
        speaker: 'Cream',
        target: undefined,
        text: 'Ah, sí. ¿Qué hiciste después?',
      },
    ])
  })

  it('stays with Cookie when the retry still includes English', () => {
    const cookieState = submitUserTurn(initialConversation, 'Today was very hot')
    const retryState = submitUserTurn(cookieState, 'Hoy fue very hot')

    expect(retryState.phase).toBe('retry-after-cookie')
    expect(getNewMessages(retryState, cookieState.messages.length)).toEqual([
      {
        speaker: 'User',
        target: 'Cookie',
        text: 'Hoy fue very hot',
      },
      {
        speaker: 'Cookie',
        target: undefined,
        text: 'You\'re close. Use "mucho calor" instead of "very hot". Say: "Hoy hizo mucho calor."',
      },
    ])
  })

  it('supports the cafe to sandwich demo flow without drifting', () => {
    const icedState = submitUserTurn(initialConversation, 'a mi me da un café iced')
    expect(getNewMessages(icedState)).toEqual([
      {
        speaker: 'User',
        target: 'Cookie',
        text: 'a mi me da un café iced',
      },
      {
        speaker: 'Cookie',
        target: undefined,
        text: 'You\'re close. Instead of "iced", say: "A mí me da un café con hielo."',
      },
    ])

    const orderState = submitUserTurn(icedState, 'a mi me da un café con hielo porfa')
    expect(getNewMessages(orderState, icedState.messages.length)).toEqual([
      {
        speaker: 'User',
        target: 'Cream',
        text: 'a mi me da un café con hielo porfa',
      },
      {
        speaker: 'Cream',
        target: undefined,
        text: 'Claro. ¿Quieres algo más?',
      },
    ])

    const sandwichState = submitUserTurn(
      orderState,
      'Gracias. I want to add sandwich. How do I say sandwich again?',
    )
    expect(getNewMessages(sandwichState, orderState.messages.length)).toEqual([
      {
        speaker: 'User',
        target: 'Cookie',
        text: 'Gracias. I want to add sandwich. How do I say sandwich again?',
      },
      {
        speaker: 'Cookie',
        target: undefined,
        text: 'sandwich = sándwich. Example: Quisiera añadir un sándwich, por favor.',
      },
    ])

    const restartState = submitUserTurn(sandwichState, 'Hola Buenos días.', {
      scenarioId: 'cafe-order',
    })
    expect(getNewMessages(restartState, sandwichState.messages.length)).toEqual([
      {
        speaker: 'User',
        target: 'Cream',
        text: 'Hola Buenos días.',
      },
      {
        speaker: 'Cream',
        target: undefined,
        text: 'Hola, buenos días. ¿Qué quieres pedir?',
      },
    ])
  })

  it('does not fall back to the cafe opener after a clear chat greeting', () => {
    const nextState = submitUserTurn(initialConversation, 'Hola Buenos días.')

    expect(nextState.phase).toBe('normal')
    expect(getNewMessages(nextState)).toEqual([
      {
        speaker: 'User',
        target: 'Cream',
        text: 'Hola Buenos días.',
      },
      {
        speaker: 'Cream',
        target: undefined,
        text: 'Hola, buenos días. ¿Cómo estás?',
      },
    ])
  })

  it('does not append or route empty input', () => {
    const nextState = submitUserTurn(initialConversation, '   ')

    expect(nextState).toBe(initialConversation)
    expect(nextState.messages).toHaveLength(initialConversation.messages.length)
    expect(nextState.phase).toBe(initialConversation.phase)
  })
})

function getNewMessages(
  state: ConversationState,
  startIndex = initialConversation.messages.length,
) {
  return state.messages.slice(startIndex).map(toComparableMessage)
}

function getLatestMessage(state: ConversationState): Message {
  return state.messages[state.messages.length - 1]
}

function toComparableMessage(message: Message) {
  return {
    speaker: message.speaker,
    target: message.target,
    text: message.text,
  }
}
