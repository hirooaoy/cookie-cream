import type { ServerConfig } from './config.js'
import { resolveNovaTranslationRequest } from './novaTranslation.js'
import { resolveLocalTranslation, type TranslationRequest, type TranslationResponse } from '../src/translationApi.js'

export async function resolveServerTranslation(
  request: TranslationRequest,
  config: ServerConfig,
): Promise<TranslationResponse> {
  if (!request.text.trim()) {
    return resolveLocalTranslation(request)
  }

  if (!config.nova.enabled) {
    return resolveLocalTranslation(request)
  }

  try {
    return await resolveNovaTranslationRequest(request, config.nova)
  } catch (error) {
    console.error('Nova translation failed, falling back to local translator.', error)
    return resolveLocalTranslation(request)
  }
}
