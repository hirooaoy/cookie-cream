import type { ServerConfig } from './config.js'
import { resolveNovaTextTurnRequest } from './novaTextTurn.js'
import { resolveLocalTurnRequest, type TurnRequest, type TurnResponse } from '../src/turnApi.js'

export async function resolveServerTurn(
  request: TurnRequest,
  config: ServerConfig,
): Promise<TurnResponse> {
  if (!request.transcript.trim()) {
    return resolveLocalTurnRequest(request)
  }

  if (!config.nova.enabled) {
    return resolveLocalTurnRequest(request)
  }

  try {
    return await resolveNovaTextTurnRequest(request, config.nova)
  } catch (error) {
    console.error('Nova turn resolution failed, falling back to local engine.', error)
    return resolveLocalTurnRequest(request)
  }
}
