import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
  type InvokeModelWithBidirectionalStreamInput,
  type InvokeModelWithBidirectionalStreamOutput,
} from '@aws-sdk/client-bedrock-runtime'
import type { AssistantAudioRequest, AssistantAudioStreamEvent } from '../src/assistantAudioApi.js'
import type { ServerConfig } from './config.js'

type SonicInputEvent = {
  event: Record<string, unknown>
}

type AssistantAudioPayload = {
  event?: {
    audioOutput?: {
      content?: string
    }
    contentEnd?: {
      contentId?: string
      role?: string
      type?: string
    }
    contentStart?: {
      contentId?: string
      role?: string
      type?: string
    }
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const assistantSampleRateHertz = 24000
const maxChunkSize = 900

let cachedClient: BedrockRuntimeClient | null = null
let cachedRegion: string | null = null

export async function streamAssistantAudio(
  request: AssistantAudioRequest,
  response: ServerResponse,
  config: ServerConfig['nova'],
): Promise<void> {
  if (!config.enabled) {
    response.writeHead(503, {
      'Content-Type': 'application/json; charset=utf-8',
    })
    response.end(JSON.stringify({ error: 'Nova assistant audio is disabled on the server.' }))
    return
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'application/x-ndjson; charset=utf-8',
  })

  try {
    const promptName = `assistant-audio-${randomUUID()}`
    const systemContentName = `system-${randomUUID()}`
    const userContentName = `user-${randomUUID()}`
    const command = new InvokeModelWithBidirectionalStreamCommand({
      modelId: config.sonicModelId,
      body: buildAssistantAudioRequestStream({
        config,
        promptName,
        request,
        systemContentName,
        userContentName,
      }),
    })
    const streamResponse = await getClient(config.region).send(command)

    await pipeAssistantAudioStream({
      body: streamResponse.body,
      request,
      response,
    })
  } catch (error) {
    writeStreamEvent(response, {
      type: 'error',
      message: getErrorMessage(error),
    })
  } finally {
    response.end()
  }
}

function getClient(region: string): BedrockRuntimeClient {
  if (!cachedClient || cachedRegion !== region) {
    cachedClient = new BedrockRuntimeClient({ region })
    cachedRegion = region
  }

  return cachedClient
}

async function* buildAssistantAudioRequestStream(input: {
  config: ServerConfig['nova']
  promptName: string
  request: AssistantAudioRequest
  systemContentName: string
  userContentName: string
}): AsyncIterable<InvokeModelWithBidirectionalStreamInput> {
  const events = buildAssistantAudioEvents(input)

  for (const event of events) {
    yield encodeEvent(event)
  }
}

function buildAssistantAudioEvents(input: {
  config: ServerConfig['nova']
  promptName: string
  request: AssistantAudioRequest
  systemContentName: string
  userContentName: string
}): SonicInputEvent[] {
  return [
    {
      event: {
        sessionStart: {
          inferenceConfiguration: {
            maxTokens: 220,
            temperature: 0,
            topP: 0.1,
          },
        },
      },
    },
    {
      event: {
        promptStart: {
          promptName: input.promptName,
          textOutputConfiguration: {
            mediaType: 'text/plain',
          },
          audioOutputConfiguration: {
            mediaType: 'audio/lpcm',
            sampleRateHertz: assistantSampleRateHertz,
            sampleSizeBits: 16,
            channelCount: 1,
            voiceId: input.config.voiceId,
            encoding: 'base64',
            audioType: 'SPEECH',
          },
        },
      },
    },
    createTextContentStartEvent(input.promptName, input.systemContentName, 'SYSTEM', false),
    ...createTextInputEvents(
      input.promptName,
      input.systemContentName,
      buildAssistantAudioSystemPrompt(input.request),
    ),
    createContentEndEvent(input.promptName, input.systemContentName),
    createTextContentStartEvent(input.promptName, input.userContentName, 'USER', true),
    ...createTextInputEvents(input.promptName, input.userContentName, normalizeWhitespace(input.request.text)),
    createContentEndEvent(input.promptName, input.userContentName),
    {
      event: {
        promptEnd: {
          promptName: input.promptName,
        },
      },
    },
    {
      event: {
        sessionEnd: {},
      },
    },
  ]
}

export function buildAssistantAudioSystemPrompt(request: AssistantAudioRequest): string {
  return [
    'You are the assistant voice playback layer for Cookie & Cream.',
    `Speaker: ${request.speaker}.`,
    `Learner language: ${request.learnerLanguage}.`,
    `Target language: ${request.targetLanguage}.`,
    'Speak the next USER text exactly as written.',
    'Do not add, remove, paraphrase, explain, translate, or coach.',
    'Use natural speech prosody only.',
    'Return assistant speech audio for the text only.',
  ].join('\n')
}

async function pipeAssistantAudioStream(input: {
  body: AsyncIterable<InvokeModelWithBidirectionalStreamOutput> | undefined
  request: AssistantAudioRequest
  response: ServerResponse
}): Promise<void> {
  if (!input.body) {
    throw new Error('Nova assistant audio stream was empty.')
  }

  let activeAssistantAudioContentId = ''
  let didStart = false
  let didEmitChunk = false

  for await (const part of input.body) {
    if ('chunk' in part && part.chunk?.bytes) {
      const payload = parseAssistantAudioPayload(part.chunk.bytes)

      if (!payload?.event) {
        continue
      }

      const contentStart = payload.event.contentStart

      if (
        contentStart &&
        contentStart.role === 'ASSISTANT' &&
        contentStart.type === 'AUDIO'
      ) {
        activeAssistantAudioContentId = contentStart.contentId ?? ''

        if (!didStart) {
          didStart = true
          writeStreamEvent(input.response, {
            type: 'audio_start',
            sampleRateHertz: assistantSampleRateHertz,
            speaker: input.request.speaker,
          })
        }

        continue
      }

      if (payload.event.audioOutput?.content && activeAssistantAudioContentId) {
        didEmitChunk = true
        writeStreamEvent(input.response, {
          type: 'audio_chunk',
          audioBase64: payload.event.audioOutput.content,
        })
        continue
      }

      const contentEnd = payload.event.contentEnd

      if (
        contentEnd &&
        activeAssistantAudioContentId &&
        (!contentEnd.contentId || contentEnd.contentId === activeAssistantAudioContentId)
      ) {
        activeAssistantAudioContentId = ''
        writeStreamEvent(input.response, {
          type: 'audio_end',
          speaker: input.request.speaker,
        })
      }

      continue
    }

    const errorMessage = getStreamErrorMessage(part)

    if (errorMessage) {
      throw new Error(errorMessage)
    }
  }

  if (!didEmitChunk) {
    throw new Error('Nova assistant audio stream returned no audio.')
  }
}

export function parseAssistantAudioPayload(bytes: Uint8Array): AssistantAudioPayload | null {
  try {
    const decoded = decoder.decode(bytes)
    return JSON.parse(decoded) as AssistantAudioPayload
  } catch {
    return null
  }
}

function createTextContentStartEvent(
  promptName: string,
  contentName: string,
  role: 'SYSTEM' | 'USER',
  interactive: boolean,
): SonicInputEvent {
  return {
    event: {
      contentStart: {
        promptName,
        contentName,
        type: 'TEXT',
        interactive,
        role,
        textInputConfiguration: {
          mediaType: 'text/plain',
        },
      },
    },
  }
}

function createTextInputEvents(
  promptName: string,
  contentName: string,
  text: string,
): SonicInputEvent[] {
  return chunkText(text).map((chunk) => ({
    event: {
      textInput: {
        promptName,
        contentName,
        content: chunk,
      },
    },
  }))
}

function createContentEndEvent(promptName: string, contentName: string): SonicInputEvent {
  return {
    event: {
      contentEnd: {
        promptName,
        contentName,
      },
    },
  }
}

function chunkText(text: string): string[] {
  const normalized = normalizeWhitespace(text)

  if (!normalized) {
    return ['...']
  }

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    chunks.push(normalized.slice(start, start + maxChunkSize))
    start += maxChunkSize
  }

  return chunks
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function encodeEvent(event: SonicInputEvent): InvokeModelWithBidirectionalStreamInput {
  return {
    chunk: {
      bytes: encoder.encode(JSON.stringify(event)),
    },
  }
}

function writeStreamEvent(response: ServerResponse, event: AssistantAudioStreamEvent): void {
  response.write(`${JSON.stringify(event)}\n`)
}

function getStreamErrorMessage(part: InvokeModelWithBidirectionalStreamOutput): string | null {
  if ('internalServerException' in part && part.internalServerException) {
    return part.internalServerException.message ?? 'Nova internal server error.'
  }

  if ('modelStreamErrorException' in part && part.modelStreamErrorException) {
    return part.modelStreamErrorException.message ?? 'Nova stream error.'
  }

  if ('validationException' in part && part.validationException) {
    return part.validationException.message ?? 'Nova validation error.'
  }

  if ('throttlingException' in part && part.throttlingException) {
    return part.throttlingException.message ?? 'Nova throttling error.'
  }

  if ('modelTimeoutException' in part && part.modelTimeoutException) {
    return part.modelTimeoutException.message ?? 'Nova timed out.'
  }

  if ('serviceUnavailableException' in part && part.serviceUnavailableException) {
    return part.serviceUnavailableException.message ?? 'Nova service unavailable.'
  }

  return null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nova assistant audio failed.'
}

export const __testables = {
  buildAssistantAudioSystemPrompt,
  parseAssistantAudioPayload,
}
