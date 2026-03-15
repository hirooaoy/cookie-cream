import type { AssistantAudioRequest, AssistantAudioStreamEvent } from '../assistantAudioApi'

type LiveAssistantAudioPlayerCallbacks = {
  onEnd?: () => void
  onStart?: () => void
}

const assistantAudioEndpoint = '/api/assistant-audio'
const defaultSampleRateHertz = 24000
const playbackLeadTimeSeconds = 0.02

export class LiveAssistantAudioPlayer {
  private abortController: AbortController | null = null
  private audioContext: AudioContext | null = null
  private readonly activeSources = new Set<AudioBufferSourceNode>()
  private nextPlaybackTime = 0
  private playbackToken = 0
  private startTimeoutId: number | null = null

  async play(
    request: AssistantAudioRequest,
    callbacks: LiveAssistantAudioPlayerCallbacks = {},
  ): Promise<void> {
    this.stop()

    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      throw new Error('Streaming assistant audio is not supported in this browser.')
    }

    if (typeof AudioContext === 'undefined') {
      throw new Error('Audio playback is not supported in this browser.')
    }

    const playbackToken = ++this.playbackToken
    const abortController = new AbortController()
    const audioContext = new AudioContext()

    this.abortController = abortController
    this.audioContext = audioContext
    this.nextPlaybackTime = 0

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const response = await fetch(assistantAudioEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response))
      }

      if (!response.body) {
        throw new Error('Assistant audio stream did not return a response body.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let bufferedText = ''
      let didReceiveAudio = false
      let didScheduleStart = false
      let sampleRateHertz = defaultSampleRateHertz

      while (true) {
        const { done, value } = await reader.read()

        bufferedText += value ? decoder.decode(value, { stream: !done }) : ''

        let newlineIndex = bufferedText.indexOf('\n')

        while (newlineIndex !== -1) {
          const rawLine = bufferedText.slice(0, newlineIndex).trim()

          bufferedText = bufferedText.slice(newlineIndex + 1)

          if (rawLine) {
            const event = parseAssistantAudioStreamEvent(rawLine)

            if (!event) {
              throw new Error('Assistant audio stream returned an invalid event.')
            }

            if (event.type === 'error') {
              throw new Error(event.message)
            }

            if (event.type === 'audio_start') {
              sampleRateHertz = event.sampleRateHertz
            }

            if (event.type === 'audio_chunk') {
              const scheduledStartDelayMs = this.enqueueAudioChunk(event.audioBase64, sampleRateHertz)

              if (scheduledStartDelayMs === null) {
                continue
              }

              didReceiveAudio = true

              if (!didScheduleStart) {
                didScheduleStart = true
                this.scheduleStartCallback(scheduledStartDelayMs, playbackToken, abortController.signal, callbacks.onStart)
              }
            }
          }

          newlineIndex = bufferedText.indexOf('\n')
        }

        if (done) {
          break
        }
      }

      if (!didReceiveAudio) {
        throw new Error('Assistant audio stream returned no audio.')
      }

      const remainingPlaybackMs = Math.max(
        0,
        (this.nextPlaybackTime - audioContext.currentTime) * 1000,
      )

      await wait(remainingPlaybackMs + 24)

      if (
        this.playbackToken === playbackToken &&
        !abortController.signal.aborted
      ) {
        callbacks.onEnd?.()
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        throw error
      }
    } finally {
      if (this.playbackToken === playbackToken) {
        this.cleanup()
      }
    }
  }

  stop(): void {
    this.playbackToken += 1
    this.abortController?.abort()
    this.cleanup()
  }

  private enqueueAudioChunk(audioBase64: string, sampleRateHertz: number): number | null {
    const audioContext = this.audioContext

    if (!audioContext) {
      return null
    }

    const channelData = decodePcmAudioChunk(audioBase64)

    if (channelData.length === 0) {
      return null
    }

    const audioBuffer = audioContext.createBuffer(1, channelData.length, sampleRateHertz)

    audioBuffer.getChannelData(0).set(channelData)

    const source = audioContext.createBufferSource()
    const startTime = Math.max(
      this.nextPlaybackTime,
      audioContext.currentTime + playbackLeadTimeSeconds,
    )

    source.buffer = audioBuffer
    source.connect(audioContext.destination)
    source.onended = () => {
      source.disconnect()
      this.activeSources.delete(source)
    }
    source.start(startTime)

    this.activeSources.add(source)
    this.nextPlaybackTime = startTime + audioBuffer.duration
    return Math.max(0, (startTime - audioContext.currentTime) * 1000)
  }

  private scheduleStartCallback(
    delayMs: number,
    playbackToken: number,
    abortSignal: AbortSignal,
    onStart?: () => void,
  ): void {
    if (!onStart) {
      return
    }

    this.clearStartTimeout()
    this.startTimeoutId = window.setTimeout(() => {
      this.startTimeoutId = null

      if (this.playbackToken !== playbackToken || abortSignal.aborted) {
        return
      }

      onStart()
    }, delayMs)
  }

  private clearStartTimeout(): void {
    if (this.startTimeoutId === null) {
      return
    }

    window.clearTimeout(this.startTimeoutId)
    this.startTimeoutId = null
  }

  private cleanup(): void {
    this.clearStartTimeout()

    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // Source may already be finished.
      }

      source.disconnect()
    }

    this.activeSources.clear()
    void this.audioContext?.close()

    this.abortController = null
    this.audioContext = null
    this.nextPlaybackTime = 0
  }
}

export function parseAssistantAudioStreamEvent(rawLine: string): AssistantAudioStreamEvent | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawLine)
  } catch {
    return null
  }

  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return null
  }

  if (
    parsed.type === 'audio_start' &&
    typeof parsed.sampleRateHertz === 'number' &&
    isAssistantAudioSpeaker(parsed.speaker)
  ) {
    return parsed as AssistantAudioStreamEvent
  }

  if (parsed.type === 'audio_chunk' && typeof parsed.audioBase64 === 'string') {
    return parsed as AssistantAudioStreamEvent
  }

  if (parsed.type === 'audio_end' && isAssistantAudioSpeaker(parsed.speaker)) {
    return parsed as AssistantAudioStreamEvent
  }

  if (parsed.type === 'error' && typeof parsed.message === 'string') {
    return parsed as AssistantAudioStreamEvent
  }

  return null
}

function decodePcmAudioChunk(audioBase64: string): Float32Array {
  const binary = window.atob(audioBase64)
  const byteLength = binary.length
  const bytes = new Uint8Array(byteLength)

  for (let index = 0; index < byteLength; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const sampleLength = Math.floor(bytes.byteLength / 2)
  const samples = new Float32Array(sampleLength)
  const view = new DataView(bytes.buffer)

  for (let index = 0; index < sampleLength; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768
  }

  return samples
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()

    if (isRecord(payload) && typeof payload.error === 'string') {
      return payload.error
    }
  } catch {
    // Ignore parse failures and fall back to the status message.
  }

  return `Assistant audio request failed with status ${response.status}.`
}

function isAssistantAudioSpeaker(value: unknown): value is AssistantAudioRequest['speaker'] {
  return value === 'Cookie' || value === 'Cream'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}
