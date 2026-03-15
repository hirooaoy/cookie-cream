# Architecture

## Reader Note

This repo was built under hackathon time pressure, so a few responsibilities are more
concentrated than they would be in a longer product cycle. That was a conscious tradeoff
to keep the live demo stable while the core interaction was still moving.

The main examples:

- `src/App.tsx` owns a lot of live UI orchestration because whisper timing, playback,
  and submit gating were easiest to debug together.
- `server/liveSonicSession.ts` keeps stream bridging and whisper-analysis timing in one
  place because that is where the important race conditions live.
- `server/novaTextTurn.ts` combines prompting with validation and repair because the
  product depends on Cookie and Cream staying sharply separated.

If you are reading this later, the architecture is not trying to be "clever messy."
It is optimized around one priority: make the live whisper-recovery loop reliable
enough to demo honestly. The first cleanup pass should preserve that behavior while
extracting smaller policy and UI modules.

## Current Product Mode

Cookie & Cream is now a live voice-first coaching flow.

1. The learner taps the mic and streams browser-captured PCM audio to `/api/live`.
2. The backend opens a Nova 2 Sonic session over WebSocket.
3. The frontend renders the current utterance in the helper area as live transcript events arrive.
4. The backend analyzes the live transcript for an English slip and emits ephemeral Cookie whisper events when a quick repair is needed.
5. After the transcript is final, a short pause passes, and there is no unresolved slip, the frontend submits the durable turn through `/api/turn`.
6. The backend uses Nova 2 Lite to decide whether Cookie or Cream should respond and to generate the durable assistant message.
7. In live mode, the frontend requests `/api/assistant-audio` so the assistant reply can play back through streamed Nova Sonic audio.
8. The learner can request a recap or translate a Cream message on demand.

The app currently launches directly into live mode.

## Reviewed Fallback Path

The earlier reviewed transcript flow is still retained in the repo as fallback architecture:

1. The learner speaks or types.
2. Browser speech recognition or manual text entry fills the transcript.
3. The transcript is submitted through the same `/api/turn` endpoint.
4. Nova 2 Lite routes the turn to Cookie or Cream and generates the durable reply.

This fallback path is not the primary story anymore, but it remains part of the codebase and uses the same durable turn backend.

## Why This Fits Voice AI

The primary loop now combines:

- live Nova 2 Sonic speech streaming
- helper-area transcript rendering
- real-time Cookie whisper repair
- durable turn routing after the live utterance settles
- streamed Nova Sonic assistant playback
- recap and translation support around the main conversation loop

## System Flow

```text
Live mode
  -> browser mic PCM audio
  -> WebSocket /api/live
  -> Amazon Nova 2 Sonic live transcript events
  -> ephemeral whisper / clear_whisper events
  -> auto-submit only after final transcript + pause + no unresolved English slip
  -> POST /api/turn
  -> Amazon Nova 2 Lite routes Cookie or Cream
  -> POST /api/assistant-audio
  -> streamed Nova Sonic assistant audio + durable chat history

Reviewed fallback
  -> browser speech capture or typed input
  -> reviewed transcript
  -> POST /api/turn
  -> Amazon Nova 2 Lite routes Cookie or Cream
  -> durable chat history

Conversation state
  -> POST /api/recap
  -> Amazon Nova 2 Lite recap

Agent message
  -> POST /api/translate
  -> Amazon Nova 2 Lite translation
```

## Frontend

Current frontend stack:
- Vite
- React
- TypeScript

Key frontend responsibilities:
- single-screen voice-first practice UI
- live session start, stop, resume, and retry controls
- helper-area live transcript rendering
- ephemeral Cookie whisper bubble
- streamed assistant audio playback with browser speech synthesis fallback
- durable message timeline and scenario starters
- reviewed transcript fallback path retained in the UI code
- session recap display
- on-demand translation display
- client-side fallback only if backend requests fail

Key files:
- `src/App.tsx`
- `src/live/liveSonicClient.ts`
- `src/live/useLivePractice.ts`
- `src/live/liveAssistantAudioPlayer.ts`
- `src/live/liveHelpers.ts`
- `src/components/WhisperBubble.tsx`
- `src/turnClient.ts`
- `src/recapClient.ts`
- `src/translationClient.ts`
- `src/prototype.ts`

## Backend

Current backend stack:
- Node HTTP server
- TypeScript
- AWS Bedrock Runtime client
- `ws` for the live Sonic WebSocket bridge

Active endpoints:
- `POST /api/turn`
- `POST /api/recap`
- `POST /api/translate`
- `POST /api/assistant-audio`
- `GET/WS /api/live`

Key backend responsibilities:
- broker the live Nova 2 Sonic WebSocket session
- emit live transcript and whisper events
- stream assistant audio back to the browser
- submit durable turns to Nova 2 Lite
- enforce Cookie vs Cream role separation
- return normalized JSON with route metadata
- generate short session recaps
- translate Cream messages on demand
- fall back to local logic if the Nova path fails

Key files:
- `server/index.ts`
- `server/liveSonicRouter.ts`
- `server/liveSonicSession.ts`
- `server/liveSonicPrompt.ts`
- `server/assistantAudioService.ts`
- `server/turnService.ts`
- `server/novaTextTurn.ts`
- `server/recapService.ts`
- `server/novaSessionRecap.ts`
- `server/translationService.ts`
- `server/novaTranslation.ts`
- `server/config.ts`

## Active Model Path Today

Current default models:
- live speech and assistant voice: `amazon.nova-2-sonic-v1:0`
- durable text turns, recap, and translation: `us.amazon.nova-2-lite-v1:0`

Where Nova 2 Sonic is used:
- `/api/live` for live speech transcription
- live whisper analysis on top of the transcript stream
- `/api/assistant-audio` for assistant playback audio

Where Nova 2 Lite is used:
- `/api/turn` for durable routing and response generation
- `/api/recap` for recap generation
- `/api/translate` for on-demand translation

## Fallback Behavior

Backend first:
- the frontend sends live, turn, recap, translation, and assistant-audio requests to the backend by default

Backend fallback:
- if the Nova call fails, the backend falls back to local logic where available

Client fallback:
- if the HTTP request itself fails, the frontend falls back locally for turn, recap, and translation requests
- if streamed assistant audio fails, the UI falls back to browser speech synthesis

This keeps the demo resilient without changing the visible live story.

## What Is Not Built Yet

Not in the current scope:
- persistent storage or database-backed history
- a broader always-on production voice stack with full duplex interruption handling everywhere
- polished multi-session analytics or progress dashboards
