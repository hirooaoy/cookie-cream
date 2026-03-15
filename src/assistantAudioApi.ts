import type { Speaker } from './prototype.js'

export type AssistantAudioSpeaker = Extract<Speaker, 'Cookie' | 'Cream'>

export type AssistantAudioRequest = {
  learnerLanguage: string
  speaker: AssistantAudioSpeaker
  targetLanguage: string
  text: string
}

export type AssistantAudioStreamEvent =
  | {
      type: 'audio_start'
      sampleRateHertz: number
      speaker: AssistantAudioSpeaker
    }
  | {
      type: 'audio_chunk'
      audioBase64: string
    }
  | {
      type: 'audio_end'
      speaker: AssistantAudioSpeaker
    }
  | {
      type: 'error'
      message: string
    }
