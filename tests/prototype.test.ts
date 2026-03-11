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
