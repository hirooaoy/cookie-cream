import type { ServerConfig } from './config.js'
import { resolveNovaSessionRecap } from './novaSessionRecap.js'
import {
  resolveLocalSessionRecap,
  type SessionRecapRequest,
  type SessionRecapResponse,
} from '../src/recapApi.js'

export async function resolveServerRecap(
  request: SessionRecapRequest,
  config: ServerConfig,
): Promise<SessionRecapResponse> {
  const userTurnCount = request.recentMessages.filter((message) => message.speaker === 'User').length

  if (userTurnCount === 0) {
    return resolveLocalSessionRecap(request)
  }

  if (!config.nova.enabled) {
    return resolveLocalSessionRecap(request)
  }

  try {
    return await resolveNovaSessionRecap(request, config.nova)
  } catch (error) {
    console.error('Nova recap resolution failed, falling back to local recap.', error)
    return resolveLocalSessionRecap(request)
  }
}
