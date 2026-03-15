import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createEmptyLiveUtterance, livePauseThresholdMs, repairTranscriptWithWhisperHint } from './liveHelpers'
import { LiveSonicClient } from './liveSonicClient'
import type { LiveServerEvent, LiveSessionStartPayload, LiveSessionStatus, LiveUtteranceState, WhisperHint } from './liveTypes'

type UseLivePracticeOptions = {
  onSubmit: (transcript: string) => Promise<void>
  sessionInput: LiveSessionStartPayload
}

type UseLivePracticeResult = {
  clear: () => void
  errorMessage: string | null
  hasActiveSession: boolean
  status: LiveSessionStatus
  utterance: LiveUtteranceState
  whisperHint: WhisperHint | null
  markCreamResponseComplete: () => void
  markCreamResponding: () => void
  reset: () => void
  retry: () => Promise<void>
  start: () => Promise<void>
  stop: () => void
  submit: () => Promise<void>
}

// This hook is the small state machine behind the live demo. The states are phrased in
// product terms such as "blocked_by_english" and "cream_responding" because the UI and
// backend both need to agree on user-visible behavior, not just socket lifecycle. For
// hackathon speed we kept the state machine local to one hook so race-condition fixes
// could ship quickly without chasing events through multiple abstractions.
export function useLivePractice(options: UseLivePracticeOptions): UseLivePracticeResult {
  const clientRef = useRef<LiveSonicClient | null>(null)
  const onSubmitRef = useRef(options.onSubmit)
  const sessionInputRef = useRef(options.sessionInput)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [status, setStatus] = useState<LiveSessionStatus>('idle')
  const [utterance, setUtterance] = useState<LiveUtteranceState>(() => createEmptyLiveUtterance())
  const [whisperHint, setWhisperHint] = useState<WhisperHint | null>(null)

  onSubmitRef.current = options.onSubmit
  sessionInputRef.current = options.sessionInput

  useEffect(() => {
    return () => {
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [])

  const disposeClient = (sendStop: boolean) => {
    const client = clientRef.current

    clientRef.current = null

    if (!client) {
      return
    }

    if (sendStop) {
      client.stop()
    }

    client.dispose()
  }

  const reset = () => {
    disposeClient(false)
    setErrorMessage(null)
    setHasActiveSession(false)
    setWhisperHint(null)
    setUtterance(createEmptyLiveUtterance())
    setStatus('idle')
  }

  const stop = () => {
    disposeClient(true)
    setErrorMessage(null)
    setHasActiveSession(false)

    const transcript = utterance.finalTranscript.trim() || utterance.transcript.trim()

    if (!transcript) {
      setUtterance(createEmptyLiveUtterance())
      setStatus('waiting_for_pause')
      return
    }

    setStatus(utterance.hasEnglishSlip || whisperHint ? 'blocked_by_english' : 'waiting_for_pause')
  }

  const clear = () => {
    disposeClient(true)
    setErrorMessage(null)
    setHasActiveSession(false)
    setWhisperHint(null)
    setUtterance(createEmptyLiveUtterance())
    setStatus('waiting_for_pause')
  }

  const startSession = async (forceRestart = false) => {
    if (!forceRestart && hasActiveSession) {
      return
    }

    disposeClient(true)

    const client = new LiveSonicClient({
      onCaptureStart: () => {
        setStatus('listening')
      },
      onEvent: (event) => {
        handleLiveEvent({
          event,
          setErrorMessage,
          setHasActiveSession,
          setStatus,
          setUtterance,
          setWhisperHint,
        })
      },
    })

    clientRef.current = client
    setErrorMessage(null)
    setHasActiveSession(true)
    setWhisperHint(null)
    setUtterance(createEmptyLiveUtterance())
    setStatus('connecting')

    try {
      await client.start(sessionInputRef.current)
    } catch (error) {
      const wasSuperseded = clientRef.current !== client
      const wasAborted = error instanceof Error && error.name === 'AbortError'

      client.dispose()

      if (wasAborted || wasSuperseded) {
        if (clientRef.current === client) {
          clientRef.current = null
        }
        return
      }

      clientRef.current = null
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start the live session.')
      setHasActiveSession(false)
      setStatus('error')
    }
  }

  const start = async () => {
    await startSession()
  }

  const retry = async () => {
    await startSession(true)
  }

  const submit = async () => {
    // The whisper hint is treated as the smallest possible patch over the final
    // transcript. That lets the durable /api/turn path see the repaired wording while
    // still preserving the live whisper moment that judges and future readers see in
    // the UI.
    const transcript = repairTranscriptWithWhisperHint(
      utterance.finalTranscript.trim() || utterance.transcript.trim(),
      whisperHint,
    ).trim()

    if (
      !transcript ||
      status === 'connecting' ||
      status === 'auto_submitting' ||
      status === 'cream_responding'
    ) {
      return
    }

    disposeClient(true)
    setErrorMessage(null)
    setHasActiveSession(false)
    setWhisperHint(null)
    setStatus('auto_submitting')

    try {
      await onSubmitRef.current(transcript)
      setUtterance(createEmptyLiveUtterance())
      setStatus('cream_responding')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit the live turn.')
      setStatus('error')
    }
  }

  const markCreamResponding = () => {
    setStatus((currentStatus) => (currentStatus === 'auto_submitting' || currentStatus === 'cream_responding' ? 'cream_responding' : currentStatus))
  }

  const markCreamResponseComplete = () => {
    setStatus((currentStatus) => (currentStatus === 'cream_responding' ? 'idle' : currentStatus))
  }

  return {
    clear,
    errorMessage,
    hasActiveSession,
    status,
    utterance,
    whisperHint,
    markCreamResponseComplete,
    markCreamResponding,
    reset,
    retry,
    start,
    stop,
    submit,
  }
}

type LiveEventStateSetters = {
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setHasActiveSession: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<LiveSessionStatus>>
  setUtterance: Dispatch<SetStateAction<LiveUtteranceState>>
  setWhisperHint: Dispatch<SetStateAction<WhisperHint | null>>
}

function handleLiveEvent(input: {
  event: LiveServerEvent
} & LiveEventStateSetters): void {
  switch (input.event.type) {
    case 'ready':
      return
    case 'transcript': {
      const event = input.event

      input.setErrorMessage(null)
      input.setUtterance((currentUtterance) => ({
        ...currentUtterance,
        transcript: event.text,
        finalTranscript: event.isFinal ? event.text : currentUtterance.finalTranscript,
        finalTranscriptVersion: event.isFinal ? event.version : currentUtterance.finalTranscriptVersion,
        pauseMs: event.isFinal ? livePauseThresholdMs : 0,
        transcriptVersion: event.version,
      }))
      input.setStatus(event.isFinal ? 'waiting_for_pause' : 'listening')
      return
    }
    case 'whisper': {
      const event = input.event

      input.setErrorMessage(null)
      input.setWhisperHint({
        englishText: event.englishText,
        spanishText: event.spanishText,
        betterSpanishPhrasing: event.betterSpanishPhrasing,
        source: 'nova',
        createdAt: Date.now(),
        version: event.version,
      })
      input.setUtterance((currentUtterance) => ({
        ...currentUtterance,
        analysisVersion: event.version,
        hasEnglishSlip: true,
      }))
      input.setStatus((currentStatus) =>
        currentStatus === 'waiting_for_pause' ? 'blocked_by_english' : currentStatus,
      )
      return
    }
    case 'clear_whisper': {
      const event = input.event

      // Version checks matter here because transcript and whisper events can cross in
      // flight. We only clear the hint if the clear belongs to the same or newer
      // transcript, otherwise a stale response can erase a newer valid repair.
      input.setWhisperHint((currentHint) =>
        currentHint && currentHint.version > event.version ? currentHint : null,
      )
      input.setUtterance((currentUtterance) => ({
        ...currentUtterance,
        analysisVersion: event.version,
        hasEnglishSlip: false,
      }))
      return
    }
    case 'assistant_audio_start':
    case 'assistant_audio_end':
      return
    case 'session_ended':
      input.setHasActiveSession(false)
      return
    case 'error':
      input.setErrorMessage(input.event.message)
      input.setHasActiveSession(false)
      input.setStatus('error')
      return
    default:
      assertNever(input.event)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected live event: ${JSON.stringify(value)}`)
}
