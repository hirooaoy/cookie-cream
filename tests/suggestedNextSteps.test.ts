import { describe, expect, it } from 'vitest'
import type { Message } from '../src/prototype'
import { buildSuggestedNextSteps } from '../src/suggestedNextSteps'

describe('buildSuggestedNextSteps', () => {
  it('returns the three targeted cafe-order suggestions for the opening prompt', () => {
    const latestAssistantMessage: Message = {
      id: 'cream-1',
      speaker: 'Cream',
      text: 'Hola. ¿Qué quieres pedir?',
    }

    expect(
      buildSuggestedNextSteps({
        latestAssistantMessage,
        selectedStarterId: 'cafe-order',
      }),
    ).toEqual([
      { id: 'cafe-order-popular', text: "What's most popular?" },
      { id: 'cafe-order-pointing', text: 'I want that' },
      { id: 'cafe-order-ice-latte', text: 'One ice latte please' },
    ])
  })

  it('returns no suggestions once the cafe conversation has moved past the opener', () => {
    const latestAssistantMessage: Message = {
      id: 'cream-2',
      speaker: 'Cream',
      text: '¡Buena pregunta! Aquí lo más popular son las tapas. ¿Te gustaría probar alguna?',
    }

    expect(
      buildSuggestedNextSteps({
        latestAssistantMessage,
        selectedStarterId: 'cafe-order',
      }),
    ).toEqual([
      { id: 'cafe-order-yes-please', text: 'Yes please' },
      { id: 'cafe-order-best-coffee', text: 'What about best coffee?' },
    ])
  })

  it('returns no suggestions for unrelated cafe follow-ups', () => {
    const latestAssistantMessage: Message = {
      id: 'cream-3',
      speaker: 'Cream',
      text: 'Claro. ¿Algo mas?',
    }

    expect(
      buildSuggestedNextSteps({
        latestAssistantMessage,
        selectedStarterId: 'cafe-order',
      }),
    ).toEqual([])
  })
})
