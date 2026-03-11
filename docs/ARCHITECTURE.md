# Architecture

## Current Product Mode

Cookie & Cream currently runs as a reviewed transcript flow:

1. The learner speaks or types.
2. Browser speech recognition can fill the editable transcript.
3. The learner reviews the transcript and presses `Send`.
4. The frontend submits the reviewed transcript to the backend.
5. The backend uses Amazon Nova 2 Lite to decide whether Cookie or Cream should respond and to generate the reply.
6. The frontend renders the new turn.
7. The learner can request a short session recap or translate an agent message on demand.

This is the real working mode in the repo today.

## Why This Counts As Multimodal

The active user flow combines:

- speech capture in the browser
- reviewed text as the model input
- multilingual reasoning with Amazon Nova
- conversational coaching, recap, and translation output

This is not live audio streaming with Nova 2 Sonic in the current product path.

## System Flow

```text
Learner speech or typed input
  -> browser transcript capture
  -> reviewed transcript
  -> POST /api/turn
  -> Amazon Nova 2 Lite
  -> Cookie or Cream reply

Conversation state
  -> POST /api/recap
  -> Amazon Nova 2 Lite
  -> short English recap

Agent message
  -> POST /api/translate
  -> Amazon Nova 2 Lite
  -> learner-facing English translation
```

## Frontend

Current frontend stack:
- Vite
- React
- TypeScript

Key frontend responsibilities:
- single-screen speech-and-text UI
- browser speech capture
- editable reviewed transcript
- scenario starters
- transcript rendering
- session recap display
- on-demand translation display
- client-side fallback only if backend requests fail

Key files:
- `src/App.tsx`
- `src/speechRecognition.ts`
- `src/turnClient.ts`
- `src/recapClient.ts`
- `src/translationClient.ts`
- `src/prototype.ts`

## Backend

Current backend stack:
- Node HTTP server
- TypeScript
- AWS Bedrock Runtime client

Active endpoints:
- `POST /api/turn`
- `POST /api/recap`
- `POST /api/translate`

Key backend responsibilities:
- submit reviewed transcript turns to Nova 2 Lite
- enforce Cookie vs Cream role separation
- return normalized turn payloads
- generate short session recaps from recent in-memory messages
- translate agent messages for the learner on demand
- fall back to local logic if the Nova path fails

Key files:
- `server/index.ts`
- `server/turnService.ts`
- `server/novaTextTurn.ts`
- `server/recapService.ts`
- `server/novaSessionRecap.ts`
- `server/translationService.ts`
- `server/novaTranslation.ts`
- `server/config.ts`

## Active Model Path Today

Current default text model:
- `us.amazon.nova-2-lite-v1:0`

Where Nova 2 Lite is used:
- `/api/turn` for routing and response generation
- `/api/recap` for session recap generation
- `/api/translate` for agent-message translation

What the backend returns:
- normalized JSON
- explicit `meta.source`
- optional `meta.modelId`

## Fallback Behavior

Backend first:
- the frontend sends turn, recap, and translation requests to the backend by default

Backend fallback:
- if the Nova call fails, the backend falls back to local logic

Client fallback:
- if the HTTP request itself fails, the frontend falls back locally

This keeps the demo reliable without changing the visible product flow.

## What Is Not Built Yet

Not in the current working path:
- live Nova 2 Sonic speech streaming
- backend audio session orchestration for Sonic
- production speech recognition beyond browser speech
- persistence or database-backed history

Nova 2 Sonic remains future work for the live spoken interaction path. It is not the active mode in this repo today.
