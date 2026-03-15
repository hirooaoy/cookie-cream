import type { Speaker } from '../prototype.js'

export type PracticeMode = 'live' | 'reviewed'

export type LiveSessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'waiting_for_pause'
  | 'blocked_by_english'
  | 'auto_submitting'
  | 'cream_responding'
  | 'error'

export interface LiveUtteranceState {
  transcript: string
  finalTranscript: string
  finalTranscriptVersion: number
  hasEnglishSlip: boolean
  pauseMs: number
  transcriptVersion: number
  analysisVersion: number
}

export interface WhisperHint {
  englishText: string
  spanishText: string
  betterSpanishPhrasing?: string
  source: 'nova'
  createdAt: number
  version: number
}

export type LiveHistoryMessage = {
  speaker: Speaker
  text: string
}

export type LiveSessionStartPayload = {
  learnerLanguage: string
  targetLanguage: string
  scenarioId: string | null
  recentMessages: LiveHistoryMessage[]
}

export type LiveClientMessage =
  | ({ type: 'start' } & LiveSessionStartPayload)
  | {
      type: 'audio_chunk'
      audioBase64: string
    }
  | {
      type: 'stop'
    }

export type LiveServerEvent =
  | {
      type: 'ready'
    }
  | {
      type: 'transcript'
      text: string
      isFinal: boolean
      version: number
      stopReason?: string
    }
  | {
      type: 'whisper'
      version: number
      englishText: string
      spanishText: string
      betterSpanishPhrasing?: string
    }
  | {
      type: 'clear_whisper'
      version: number
    }
  | {
      type: 'assistant_audio_start' | 'assistant_audio_end'
    }
  | {
      type: 'error'
      message: string
    }
  | {
      type: 'session_ended'
    }
