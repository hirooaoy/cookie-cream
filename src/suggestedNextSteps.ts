import type { Message } from './prototype'

export type SuggestedNextStep = {
  id: string
  text: string
}

const cafeOrderOpeningSuggestions: SuggestedNextStep[] = [
  { id: 'cafe-order-popular', text: "What's most popular?" },
  { id: 'cafe-order-pointing', text: 'I want that' },
  { id: 'cafe-order-ice-latte', text: 'One ice latte please' },
]

const cafeOrderTapasSuggestions: SuggestedNextStep[] = [
  { id: 'cafe-order-yes-please', text: 'Yes please' },
  { id: 'cafe-order-best-coffee', text: 'What about best coffee?' },
]

export function buildSuggestedNextSteps(input: {
  latestAssistantMessage: Message | null | undefined
  selectedStarterId: string | null
}): SuggestedNextStep[] {
  if (input.selectedStarterId !== 'cafe-order') {
    return []
  }

  const latestAssistantMessage = input.latestAssistantMessage

  if (!latestAssistantMessage || latestAssistantMessage.speaker !== 'Cream') {
    return []
  }

  if (normalizeMessageForMatch(latestAssistantMessage.text) === 'hola que quieres pedir') {
    return cafeOrderOpeningSuggestions
  }

  // TODO: Replace these exact-message matches with a more scalable cafe-order suggestion engine.
  if (
    normalizeMessageForMatch(latestAssistantMessage.text) ===
    'buena pregunta aqui lo mas popular son las tapas te gustaria probar alguna'
  ) {
    return cafeOrderTapasSuggestions
  }

  return []
}

function normalizeMessageForMatch(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
