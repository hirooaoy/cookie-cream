import { submitUserTurn, type ConversationState, type Message, type Phase, type UserTarget } from './prototype.js'

export type TurnRequest = {
  transcript: string
  phase: Phase
  recentMessages: Message[]
  learnerLanguage: string
  targetLanguage: string
}

export type TurnRoute = UserTarget | 'none'
export type TurnSource = 'nova' | 'local-fallback'
export type TurnMeta = {
  route: TurnRoute
  source: TurnSource
  modelId?: string
}

export type TurnResponse = {
  messages: Message[]
  nextPhase: Phase
  meta: TurnMeta
}

export function resolveLocalTurnRequest(request: TurnRequest): TurnResponse {
  const currentState: ConversationState = {
    messages: request.recentMessages,
    phase: request.phase,
  }
  const nextState = submitUserTurn(currentState, request.transcript)
  const newMessages = nextState.messages.slice(request.recentMessages.length)

  return {
    messages: newMessages,
    nextPhase: nextState.phase,
    meta: {
      route: getRoute(newMessages),
      source: 'local-fallback',
    },
  }
}

export const resolveTurnRequest = resolveLocalTurnRequest

function getRoute(messages: Message[]): TurnRoute {
  const userMessage = messages.find((message) => message.speaker === 'User')

  return userMessage?.target ?? 'none'
}
