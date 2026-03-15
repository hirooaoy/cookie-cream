import type { Message } from '../src/prototype.js'

export type LiveHistoryMessage = Pick<Message, 'speaker' | 'text'>

export type LiveSessionStartMessage = {
  type: 'start'
  learnerLanguage: string
  targetLanguage: string
  scenarioId: string | null
  recentMessages: LiveHistoryMessage[]
}

export type LiveAudioChunkMessage = {
  type: 'audio_chunk'
  audioBase64: string
}

export type LiveStopMessage = {
  type: 'stop'
}

export type LiveClientMessage =
  | LiveSessionStartMessage
  | LiveAudioChunkMessage
  | LiveStopMessage

export type LiveReadyEvent = {
  type: 'ready'
}

export type LiveTranscriptEvent = {
  type: 'transcript'
  text: string
  isFinal: boolean
  version: number
  stopReason?: string
}

export type LiveWhisperEvent = {
  type: 'whisper'
  version: number
  englishText: string
  spanishText: string
  betterSpanishPhrasing?: string
}

export type LiveClearWhisperEvent = {
  type: 'clear_whisper'
  version: number
}

export type LiveAssistantAudioLifecycleEvent = {
  type: 'assistant_audio_start' | 'assistant_audio_end'
}

export type LiveErrorEvent = {
  type: 'error'
  message: string
}

export type LiveSessionEndedEvent = {
  type: 'session_ended'
}

export type LiveServerEvent =
  | LiveReadyEvent
  | LiveTranscriptEvent
  | LiveWhisperEvent
  | LiveClearWhisperEvent
  | LiveAssistantAudioLifecycleEvent
  | LiveErrorEvent
  | LiveSessionEndedEvent

export type LiveWhisperAnalysis = {
  hasEnglishSlip: boolean
  englishText?: string
  spanishText?: string
  betterSpanishPhrasing?: string
}

export type LiveSonicStartInput = Omit<LiveSessionStartMessage, 'type'>

export function parseLiveClientMessage(rawPayload: string): LiveClientMessage | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawPayload)
  } catch {
    return null
  }

  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return null
  }

  if (parsed.type === 'start') {
    if (
      typeof parsed.learnerLanguage !== 'string' ||
      typeof parsed.targetLanguage !== 'string' ||
      !(parsed.scenarioId === null || typeof parsed.scenarioId === 'string') ||
      !Array.isArray(parsed.recentMessages) ||
      !parsed.recentMessages.every(isLiveHistoryMessage)
    ) {
      return null
    }

    return {
      type: 'start',
      learnerLanguage: parsed.learnerLanguage,
      targetLanguage: parsed.targetLanguage,
      scenarioId: parsed.scenarioId,
      recentMessages: parsed.recentMessages,
    }
  }

  if (parsed.type === 'audio_chunk') {
    if (typeof parsed.audioBase64 !== 'string') {
      return null
    }

    return {
      type: 'audio_chunk',
      audioBase64: parsed.audioBase64,
    }
  }

  if (parsed.type === 'stop') {
    return { type: 'stop' }
  }

  return null
}

function isLiveHistoryMessage(value: unknown): value is LiveHistoryMessage {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    (value.speaker === 'Cream' ||
      value.speaker === 'Cookie' ||
      value.speaker === 'User' ||
      value.speaker === 'System')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
