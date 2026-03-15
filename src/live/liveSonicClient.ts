import type { LiveClientMessage, LiveServerEvent, LiveSessionStartPayload } from './liveTypes'

type LiveSonicClientCallbacks = {
  onCaptureStart: () => void
  onEvent: (event: LiveServerEvent) => void
}

const captureSampleRate = 16000
const processorBufferSize = 1024
const liveSocketPath = '/api/live'

export class LiveSonicClient {
  private readonly callbacks: LiveSonicClientCallbacks
  private audioContext: AudioContext | null = null
  private captureNode: GainNode | null = null
  private mediaStream: MediaStream | null = null
  private processorNode: ScriptProcessorNode | null = null
  private readyPromise: Promise<void> | null = null
  private readyRejecter: ((error: Error) => void) | null = null
  private readyResolver: (() => void) | null = null
  private socket: WebSocket | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private startToken = 0

  constructor(callbacks: LiveSonicClientCallbacks) {
    this.callbacks = callbacks
  }

  async start(payload: LiveSessionStartPayload): Promise<void> {
    const startToken = ++this.startToken

    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      throw new Error('WebSocket live mode is not supported in this browser.')
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      throw new Error('Microphone capture is not supported in this browser.')
    }

    if (typeof AudioContext === 'undefined') {
      throw new Error('Audio capture is not supported in this browser.')
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolver = () => {
        this.clearReadyPromise()
        resolve()
      }
      this.readyRejecter = (error) => {
        this.clearReadyPromise()
        reject(error)
      }
    })

    const socket = new WebSocket(buildLiveSocketUrl())

    this.socket = socket
    socket.addEventListener('message', this.handleSocketMessage)
    socket.addEventListener('error', this.handleSocketError)
    socket.addEventListener('close', this.handleSocketClose)

    await waitForSocketOpen(socket)

    if (!this.isCurrentStart(startToken)) {
      throw createAbortError('The live session was stopped before capture started.')
    }

    socket.send(serializeMessage({ type: 'start', ...payload }))
    await this.readyPromise

    if (!this.isCurrentStart(startToken)) {
      throw createAbortError('The live session was stopped before capture started.')
    }

    await this.beginCapture(startToken)
  }

  stop(): void {
    this.startToken += 1
    this.rejectReadyPromise(createAbortError('The live session was stopped.'))
    this.stopCapture()
    this.send({ type: 'stop' })
  }

  dispose(): void {
    this.startToken += 1
    this.rejectReadyPromise(createAbortError('The live session was disposed.'))
    this.stopCapture()

    if (this.socket) {
      this.socket.removeEventListener('message', this.handleSocketMessage)
      this.socket.removeEventListener('error', this.handleSocketError)
      this.socket.removeEventListener('close', this.handleSocketClose)
      this.socket.close()
      this.socket = null
    }

    this.clearReadyPromise()
  }

  private beginCapture = async (startToken: number): Promise<void> => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    if (!this.isCurrentStart(startToken)) {
      stopMediaStream(mediaStream)
      throw createAbortError('The live session was stopped before capture started.')
    }

    const audioContext = new AudioContext()

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    if (!this.isCurrentStart(startToken)) {
      stopMediaStream(mediaStream)
      void audioContext.close()
      throw createAbortError('The live session was stopped before capture started.')
    }

    const sourceNode = audioContext.createMediaStreamSource(mediaStream)
    const processorNode = audioContext.createScriptProcessor(processorBufferSize, 1, 1)
    const captureNode = audioContext.createGain()

    captureNode.gain.value = 0
    processorNode.onaudioprocess = (event) => {
      if (!this.isCurrentStart(startToken)) {
        return
      }

      const socket = this.socket

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return
      }

      const channelData = event.inputBuffer.getChannelData(0)
      const pcm = downsampleFloat32ToInt16(channelData, audioContext.sampleRate, captureSampleRate)

      if (pcm.length === 0) {
        return
      }

      socket.send(
        serializeMessage({
          type: 'audio_chunk',
          audioBase64: encodePcmChunk(pcm),
        }),
      )
    }

    sourceNode.connect(processorNode)
    processorNode.connect(captureNode)
    captureNode.connect(audioContext.destination)

    if (!this.isCurrentStart(startToken)) {
      processorNode.disconnect()
      sourceNode.disconnect()
      captureNode.disconnect()
      stopMediaStream(mediaStream)
      void audioContext.close()
      throw createAbortError('The live session was stopped before capture started.')
    }

    this.mediaStream = mediaStream
    this.audioContext = audioContext
    this.sourceNode = sourceNode
    this.processorNode = processorNode
    this.captureNode = captureNode
    this.callbacks.onCaptureStart()
  }

  private handleSocketClose = (): void => {
    this.stopCapture()
    this.rejectReadyPromise(new Error('The live session closed before it was ready.'))
    this.socket = null
  }

  private handleSocketError = (): void => {
    this.rejectReadyPromise(new Error('The live session connection failed.'))
    this.callbacks.onEvent({
      type: 'error',
      message: 'The live session connection failed.',
    })
  }

  private handleSocketMessage = (event: MessageEvent<string>): void => {
    const payload = parseServerEvent(event.data)

    if (!payload) {
      this.callbacks.onEvent({
        type: 'error',
        message: 'The live session returned an invalid event.',
      })
      return
    }

    if (payload.type === 'ready') {
      this.readyResolver?.()
    }

    this.callbacks.onEvent(payload)
  }

  private clearReadyPromise(): void {
    this.readyPromise = null
    this.readyResolver = null
    this.readyRejecter = null
  }

  private isCurrentStart(startToken: number): boolean {
    return this.startToken === startToken
  }

  private rejectReadyPromise(error: Error): void {
    this.readyRejecter?.(error)
  }

  private send(message: LiveClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    this.socket.send(serializeMessage(message))
  }

  private stopCapture(): void {
    this.processorNode?.disconnect()
    this.sourceNode?.disconnect()
    this.captureNode?.disconnect()

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop()
      }
    }

    void this.audioContext?.close()

    this.processorNode = null
    this.sourceNode = null
    this.captureNode = null
    this.mediaStream = null
    this.audioContext = null
  }
}

function createAbortError(message: string): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

function stopMediaStream(mediaStream: MediaStream): void {
  for (const track of mediaStream.getTracks()) {
    track.stop()
  }
}

function buildLiveSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}${liveSocketPath}`
}

function waitForSocketOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('The live session connection failed.'))
    }
    const handleClose = () => {
      cleanup()
      reject(new Error('The live session closed before it was ready.'))
    }
    const cleanup = () => {
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('error', handleError)
      socket.removeEventListener('close', handleClose)
    }

    socket.addEventListener('open', handleOpen, { once: true })
    socket.addEventListener('error', handleError, { once: true })
    socket.addEventListener('close', handleClose, { once: true })
  })
}

function downsampleFloat32ToInt16(
  source: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Int16Array {
  if (source.length === 0) {
    return new Int16Array(0)
  }

  if (inputSampleRate === targetSampleRate) {
    return float32ToInt16(source)
  }

  const sampleRateRatio = inputSampleRate / targetSampleRate
  const targetLength = Math.round(source.length / sampleRateRatio)
  const result = new Int16Array(targetLength)
  let sourceIndex = 0

  for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
    const nextSourceIndex = Math.round((targetIndex + 1) * sampleRateRatio)
    let sum = 0
    let count = 0

    for (let index = sourceIndex; index < nextSourceIndex && index < source.length; index += 1) {
      sum += source[index]
      count += 1
    }

    const sample = count > 0 ? sum / count : source[Math.min(sourceIndex, source.length - 1)] ?? 0

    result[targetIndex] = normalizePcmSample(sample)
    sourceIndex = nextSourceIndex
  }

  return result
}

function float32ToInt16(source: Float32Array): Int16Array {
  const result = new Int16Array(source.length)

  for (let index = 0; index < source.length; index += 1) {
    result[index] = normalizePcmSample(source[index] ?? 0)
  }

  return result
}

function normalizePcmSample(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))

  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
}

function encodePcmChunk(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return window.btoa(binary)
}

function parseServerEvent(rawPayload: string): LiveServerEvent | null {
  try {
    return JSON.parse(rawPayload) as LiveServerEvent
  } catch {
    return null
  }
}

function serializeMessage(message: LiveClientMessage): string {
  return JSON.stringify(message)
}

export const __testables = {
  downsampleFloat32ToInt16,
}
