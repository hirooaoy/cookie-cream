import { describe, expect, it } from 'vitest'
import type { Message } from '../src/prototype'
import { buildSessionRecapPresentation } from '../src/recapPresentation'

describe('buildSessionRecapPresentation', () => {
  it('builds a compact recap with an extracted better phrase and day-summary copy', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        speaker: 'User',
        text: 'Hola, hoy was busy.',
      },
      {
        id: 'cream-2',
        speaker: 'Cookie',
        text: '¿Qué hiciste después?',
        vocabulary: [
          {
            term: 'parque',
            translation: 'park',
          },
          {
            term: 'amigos',
            translation: 'friends',
          },
        ],
      },
      {
        id: 'user-3',
        speaker: 'User',
        text: 'Fui al parque con mis amigos.',
      },
    ]

    const presentation = buildSessionRecapPresentation(
      {
        didWell: [
          'You kept parts of the conversation in Spanish.',
          'You retried after feedback instead of stopping.',
          'You answered with full ideas, not just one word.',
        ],
        betterWay: 'Instead of saying "I love juice", try "Me encanta el jugo."',
        tryNext: 'Try adding one more detail and one short follow-up question in Spanish.',
      },
      messages,
    )

    expect(presentation.summary).toBe(
      'You practiced talking about your day, used full-sentence answers, and switched into English once.',
    )
    expect(presentation.vocabulary).toEqual([
      {
        term: 'parque',
        translation: 'park',
      },
      {
        term: 'amigos',
        translation: 'friends',
      },
    ])
    expect(presentation.nextStep).toEqual({
      note: 'Try adding one more detail and one short follow-up question in Spanish.',
      prompt: '¿Qué hiciste hoy?',
    })
  })

  it('uses topic-aware practice prompts when the recap does not include one', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        speaker: 'User',
        text: 'Hola.',
      },
      {
        id: 'cream-2',
        speaker: 'Cookie',
        text: '¿Qué quieres pedir?',
        vocabulary: [
          {
            term: 'cafe',
            translation: 'coffee',
          },
          {
            term: 'muffin',
            translation: 'muffin',
          },
        ],
      },
      {
        id: 'user-3',
        speaker: 'User',
        text: 'Quiero un cafe con leche y un muffin.',
      },
    ]

    const presentation = buildSessionRecapPresentation(
      {
        didWell: [
          'You kept the conversation moving across multiple turns.',
          'You answered with full ideas, not just one word.',
          'You gave Cream enough detail to continue the conversation.',
        ],
        betterWay: 'A cleaner Spanish version would be: "Comí tacos."',
        tryNext: 'Try adding one more detail and one short follow-up question in Spanish.',
      },
      messages,
    )

    expect(presentation.summary).toBe(
      'You practiced ordering drinks, used full-sentence answers, and stayed in Spanish throughout.',
    )
    expect(presentation.vocabulary).toEqual([
      {
        term: 'cafe',
        translation: 'coffee',
      },
      {
        term: 'muffin',
        translation: 'muffin',
      },
    ])
    expect(presentation.nextStep.prompt).toBe('¿Qué quieres pedir?')
  })

  it('aggregates unique vocabulary across cookie turns', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        speaker: 'User',
        text: 'Hoy I went to eat chicken.',
      },
      {
        id: 'cookie-2',
        speaker: 'Cookie',
        text: 'Try this in Spanish.',
        vocabulary: [
          {
            term: 'pollo',
            translation: 'chicken',
          },
          {
            term: 'hoy',
            translation: 'today',
          },
        ],
      },
      {
        id: 'cookie-3',
        speaker: 'Cookie',
        text: 'One more try.',
        vocabulary: [
          {
            term: 'pollo',
            translation: 'chicken',
          },
          {
            term: 'comer',
            translation: 'to eat',
          },
        ],
      },
    ]

    const presentation = buildSessionRecapPresentation(
      {
        didWell: [
          'You kept trying in Spanish.',
          'You shared a full idea.',
          'You stayed engaged in the conversation.',
        ],
        betterWay:
          "Guide the learner to fully switch to Spanish: use 'Hoy fui a comer pollo' instead of mixing languages.",
        tryNext: 'Practice describing another activity from today using a full Spanish sentence.',
      },
      messages,
    )

    expect(presentation.vocabulary).toEqual([
      {
        term: 'pollo',
        translation: 'chicken',
      },
      {
        term: 'hoy',
        translation: 'today',
      },
      {
        term: 'comer',
        translation: 'to eat',
      },
    ])
  })

  it('falls back to coached phrase vocabulary when structured vocab is missing', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        speaker: 'User',
        text: 'A mí me da un café iced.',
      },
      {
        id: 'cookie-2',
        speaker: 'Cookie',
        text: 'You\'re close. "iced" is "helado" in Spanish. Say: "A mí me da un café con hielo."',
      },
    ]

    const presentation = buildSessionRecapPresentation(
      {
        didWell: [
          'You kept the order moving in Spanish.',
          'You retried after feedback instead of stopping.',
          'You stayed specific about what you wanted.',
        ],
        betterWay: 'Instead of mixing in "iced", try: "A mí me da un café con hielo."',
        tryNext: 'Practice ordering another cold drink in Spanish.',
      },
      messages,
    )

    expect(presentation.vocabulary).toEqual([
      {
        term: 'café',
        translation: 'coffee',
      },
      {
        term: 'hielo',
        translation: 'ice',
      },
    ])
  })

  it('extracts inline sandwich vocabulary from Cookie teaching text', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        speaker: 'User',
        text: 'Gracias. I want to add sandwich. How do I say sandwich again?',
      },
      {
        id: 'cookie-2',
        speaker: 'Cookie',
        text: 'sandwich = sándwich. Example: Quisiera añadir un sándwich, por favor.',
      },
    ]

    const presentation = buildSessionRecapPresentation(
      {
        didWell: [
          'You stayed engaged in the cafe conversation.',
          'You asked for the missing word instead of stopping.',
          'You kept building the order in Spanish.',
        ],
        betterWay: 'Try combining your coffee and sandwich request in one sentence.',
        tryNext: 'Practice ordering the drink and the sandwich together in Spanish.',
      },
      messages,
    )

    expect(presentation.vocabulary).toContainEqual({
      term: 'sándwich',
      translation: 'sandwich',
    })
  })
})
