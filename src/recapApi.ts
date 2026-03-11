import { containsEnglish, containsSpanish, type Message } from './prototype.js'

export type SessionRecapRequest = {
  recentMessages: Message[]
  learnerLanguage: string
  targetLanguage: string
}

export type SessionRecap = {
  didWell: [string, string, string]
  betterWay: string
  tryNext: string
}

export type SessionRecapMeta = {
  source: 'nova' | 'local-fallback'
  modelId?: string
}

export type SessionRecapResponse = {
  recap: SessionRecap
  meta: SessionRecapMeta
}

export function resolveLocalSessionRecap(request: SessionRecapRequest): SessionRecapResponse {
  const userMessages = request.recentMessages.filter((message) => message.speaker === 'User')
  const cookieMessages = request.recentMessages.filter((message) => message.speaker === 'Cookie')
  const spanishOnlyTurns = userMessages.filter(
    (message) => containsSpanish(message.text) && !containsEnglish(message.text),
  )
  const detailedTurns = userMessages.filter((message) => message.text.trim().split(/\s+/).length >= 4)
  const mixedTurn = [...userMessages].reverse().find((message) => containsEnglish(message.text))

  const didWell = buildDidWellItems({
    userTurnCount: userMessages.length,
    cookieTurnCount: cookieMessages.length,
    spanishOnlyTurnCount: spanishOnlyTurns.length,
    detailedTurnCount: detailedTurns.length,
  })

  return {
    recap: {
      didWell,
      betterWay: buildBetterWay(mixedTurn?.text),
      tryNext: 'Try adding one more detail and one short follow-up question in Spanish.',
    },
    meta: {
      source: 'local-fallback',
    },
  }
}

function buildDidWellItems(input: {
  userTurnCount: number
  cookieTurnCount: number
  spanishOnlyTurnCount: number
  detailedTurnCount: number
}): [string, string, string] {
  const items: string[] = []

  if (input.spanishOnlyTurnCount > 0) {
    items.push('You kept parts of the conversation in Spanish.')
  }

  if (input.cookieTurnCount > 0) {
    items.push('You retried after feedback instead of stopping.')
  }

  if (input.detailedTurnCount > 0) {
    items.push('You answered with full ideas, not just one word.')
  }

  if (input.userTurnCount > 1) {
    items.push('You kept the conversation moving across multiple turns.')
  }

  items.push('You stayed engaged and kept trying to express your idea.')
  items.push('You gave Cream enough detail to continue the conversation.')

  return [items[0], items[1], items[2]]
}

function buildBetterWay(mixedTranscript: string | undefined): string {
  if (!mixedTranscript) {
    return 'One better version to try: keep the whole idea in Spanish, even if it is simple.'
  }

  if (/very hot|hot/i.test(mixedTranscript)) {
    return 'Instead of mixing in English, try: "Hoy hizo mucho calor."'
  }

  if (/eated|ate tacos/i.test(mixedTranscript)) {
    return 'A cleaner Spanish version would be: "Comí tacos."'
  }

  return 'A better habit is to say the whole thought in Spanish instead of switching languages.'
}
