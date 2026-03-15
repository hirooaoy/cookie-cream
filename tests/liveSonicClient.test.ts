import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveSonicClient } from '../src/live/liveSonicClient'

type Deferred<T> = {
  promise: Promise<T>
  reject: (error?: unknown) => void
  resolve: (value: T) => void
}

type MockTrack = {
  stop: ReturnType<typeof vi.fn>
}

type MockMediaStream = {
  getTracks: () => MockTrack[]
}

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly sent: string[] = []
  readyState = MockWebSocket.CONNECTING
  private readonly listeners = new Map<string, Set<(event?: unknown) => void>>()

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event?: unknown) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  send(message: string): void {
    this.sent.push(message)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.dispatch('close', {})
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN
    this.dispatch('open', {})
  }

  emitMessage(data: string): void {
    this.dispatch('message', { data })
  }

  private dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = []

  readonly close = vi.fn(async () => {})
  readonly createGain = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }))
  readonly createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))
  readonly createScriptProcessor = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null as ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null,
  }))
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly sampleRate = 48_000
  state: 'running' | 'suspended' = 'running'

  constructor() {
    MockAudioContext.instances.push(this)
  }
}

describe('LiveSonicClient', () => {
  const getUserMedia = vi.fn<() => Promise<MockMediaStream>>()

  beforeEach(() => {
    MockWebSocket.instances = []
    MockAudioContext.instances = []

    vi.stubGlobal('window', {
      location: {
        host: 'localhost:5173',
        protocol: 'http:',
      },
    })
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    vi.stubGlobal('AudioContext', MockAudioContext as unknown as typeof AudioContext)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stops active microphone tracks when stop is called', async () => {
    const track = createMockTrack()

    getUserMedia.mockResolvedValueOnce(createMockMediaStream(track))

    const onCaptureStart = vi.fn()
    const client = new LiveSonicClient({
      onCaptureStart,
      onEvent: vi.fn(),
    })

    const startPromise = client.start(createMockSessionPayload())
    const socket = getLastSocket()

    socket.open()
    socket.emitMessage(JSON.stringify({ type: 'ready' }))

    await startPromise

    client.stop()

    expect(onCaptureStart).toHaveBeenCalledTimes(1)
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(MockAudioContext.instances[0]?.close).toHaveBeenCalledTimes(1)
    expect(socket.sent.map((message) => JSON.parse(message).type)).toContain('stop')
  })

  it('stops a late microphone stream if stop is pressed during startup', async () => {
    const captureRequestStarted = createDeferred<void>()
    const deferredStream = createDeferred<MockMediaStream>()
    const lateTrack = createMockTrack()

    getUserMedia.mockImplementationOnce(async () => {
      captureRequestStarted.resolve()
      return deferredStream.promise
    })

    const onCaptureStart = vi.fn()
    const client = new LiveSonicClient({
      onCaptureStart,
      onEvent: vi.fn(),
    })

    const startPromise = client.start(createMockSessionPayload())
    const socket = getLastSocket()

    socket.open()
    socket.emitMessage(JSON.stringify({ type: 'ready' }))
    await captureRequestStarted.promise

    client.stop()
    deferredStream.resolve(createMockMediaStream(lateTrack))

    await expect(startPromise).rejects.toMatchObject({
      name: 'AbortError',
    })

    expect(onCaptureStart).not.toHaveBeenCalled()
    expect(lateTrack.stop).toHaveBeenCalledTimes(1)
  })
})

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

function createMockTrack(): MockTrack {
  return {
    stop: vi.fn(),
  }
}

function createMockMediaStream(track: MockTrack): MockMediaStream {
  return {
    getTracks: () => [track],
  }
}

function createMockSessionPayload() {
  return {
    learnerLanguage: 'English',
    targetLanguage: 'Spanish',
    scenarioId: 'cafe-order',
    recentMessages: [],
  }
}

function getLastSocket(): MockWebSocket {
  const socket = MockWebSocket.instances.at(-1)

  if (!socket) {
    throw new Error('Expected a live websocket instance.')
  }

  return socket
}
