import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getServerConfig } from './config.js'
import { resolveServerRecap } from './recapService.js'
import { resolveServerTranslation } from './translationService.js'
import { resolveServerTurn } from './turnService.js'
import type { SessionRecapRequest } from '../src/recapApi.js'
import type { TranslationRequest } from '../src/translationApi.js'
import type { TurnRequest } from '../src/turnApi.js'

const serverConfig = getServerConfig()
const supportedMethods = 'POST, OPTIONS'
const allowedHeaders = 'Content-Type'

createServer(async (request, response) => {
  applyCommonHeaders(response)

  if (!request.url) {
    sendJson(response, 400, { error: 'Missing request URL.' })
    return
  }

  const { pathname } = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)

  if ((pathname === '/api/turn' || pathname === '/api/recap' || pathname === '/api/translate') && request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (pathname === '/api/turn' && request.method === 'POST') {
    await handleTurnRequest(request, response)
    return
  }

  if (pathname === '/api/recap' && request.method === 'POST') {
    await handleRecapRequest(request, response)
    return
  }

  if (pathname === '/api/translate' && request.method === 'POST') {
    await handleTranslationRequest(request, response)
    return
  }

  sendJson(response, 404, { error: 'Not found.' })
}).listen(serverConfig.port, () => {
  console.log(`Cookie & Cream API listening on http://localhost:${serverConfig.port}`)
})

async function handleTurnRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  let requestBody: unknown

  try {
    requestBody = await readJsonBody(request)
  } catch {
    sendJson(response, 400, { error: 'Request body must be valid JSON.' })
    return
  }

  if (!isTurnRequest(requestBody)) {
    sendJson(response, 400, {
      error: 'Invalid turn request payload.',
      expected: {
        transcript: 'string',
        phase: "'normal' | 'retry-after-cookie'",
        recentMessages: 'Message[]',
        learnerLanguage: 'string',
        targetLanguage: 'string',
      },
    })
    return
  }

  sendJson(response, 200, await resolveServerTurn(requestBody, serverConfig))
}

async function handleRecapRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  let requestBody: unknown

  try {
    requestBody = await readJsonBody(request)
  } catch {
    sendJson(response, 400, { error: 'Request body must be valid JSON.' })
    return
  }

  if (!isSessionRecapRequest(requestBody)) {
    sendJson(response, 400, {
      error: 'Invalid recap request payload.',
      expected: {
        recentMessages: 'Message[]',
        learnerLanguage: 'string',
        targetLanguage: 'string',
      },
    })
    return
  }

  sendJson(response, 200, await resolveServerRecap(requestBody, serverConfig))
}

async function handleTranslationRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  let requestBody: unknown

  try {
    requestBody = await readJsonBody(request)
  } catch {
    sendJson(response, 400, { error: 'Request body must be valid JSON.' })
    return
  }

  if (!isTranslationRequest(requestBody)) {
    sendJson(response, 400, {
      error: 'Invalid translation request payload.',
      expected: {
        text: 'string',
        speaker: "'Cookie' | 'Cream'",
        learnerLanguage: 'string',
        targetLanguage: 'string',
      },
    })
    return
  }

  sendJson(response, 200, await resolveServerTranslation(requestBody, serverConfig))
}

function applyCommonHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', supportedMethods)
  response.setHeader('Access-Control-Allow-Headers', allowedHeaders)
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode)
  response.end(JSON.stringify(payload))
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let rawBody = ''

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      rawBody += chunk
    })
    request.on('end', () => {
      if (!rawBody) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(rawBody))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function isTurnRequest(value: unknown): value is TurnRequest {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.transcript === 'string' &&
    isPhase(value.phase) &&
    Array.isArray(value.recentMessages) &&
    value.recentMessages.every(isMessage) &&
    typeof value.learnerLanguage === 'string' &&
    typeof value.targetLanguage === 'string'
  )
}

function isSessionRecapRequest(value: unknown): value is SessionRecapRequest {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.recentMessages) &&
    value.recentMessages.every(isMessage) &&
    typeof value.learnerLanguage === 'string' &&
    typeof value.targetLanguage === 'string'
  )
}

function isTranslationRequest(value: unknown): value is TranslationRequest {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.text === 'string' &&
    isAgentSpeaker(value.speaker) &&
    typeof value.learnerLanguage === 'string' &&
    typeof value.targetLanguage === 'string'
  )
}

function isMessage(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isSpeaker(value.speaker) &&
    typeof value.text === 'string' &&
    (value.target === undefined || isTarget(value.target))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPhase(value: unknown): value is TurnRequest['phase'] {
  return value === 'normal' || value === 'retry-after-cookie'
}

function isSpeaker(value: unknown): boolean {
  return value === 'Cream' || value === 'Cookie' || value === 'User'
}

function isAgentSpeaker(value: unknown): value is TranslationRequest['speaker'] {
  return value === 'Cream' || value === 'Cookie'
}

function isTarget(value: unknown): boolean {
  return value === 'Cream' || value === 'Cookie'
}
