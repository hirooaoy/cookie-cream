# Cookie & Cream

Cookie & Cream helps English-speaking Spanish learners recover when they slip into English mid-sentence. Cream keeps the conversation moving in Spanish. Cookie steps in only long enough to whisper a quick fix, then the learner retries and keeps talking.

The main demo is live and voice-first: microphone audio streams into Amazon Nova 2 Sonic, the current utterance appears in real time, Cookie catches English slips, and the cleaned-up turn continues through the normal conversation flow.

## At A Glance

- Audience: intermediate Spanish learners who can mostly keep up until a single English phrase breaks their momentum.
- Golden path: speak -> live Nova 2 Sonic transcript -> English slip -> Cookie whisper -> Spanish retry -> Cream continues -> recap.
- Novel mechanic: a two-agent whisper recovery loop instead of a tutor that interrupts the whole conversation or corrects you after the moment has already passed.
- Amazon Nova: Nova 2 Sonic handles live speech and assistant playback. Nova 2 Lite handles turn routing, recap, and translation.
- Proof: `npm test` passes with `92` tests, `npm run build` passes, and `npm run eval:routes` passes `80/80` route checks on the Nova path.

## Problem

Language learners often do not fail after the sentence. They fail in the middle of it.

Most tools either correct them after the fact or turn the moment into a lesson. That breaks the conversation exactly when the learner needs help recovering.

## Solution

Cookie & Cream uses a two-agent handoff that keeps the conversation alive:

- Cream is the Spanish conversation partner who keeps talking naturally.
- Cookie appears only when the learner slips into English, gives one better Spanish phrasing, and gets out of the way.

The shipped demo is live-first:

- `Live` mode streams microphone PCM audio to Nova 2 Sonic over WebSocket, renders the current utterance in the helper area, streams Sonic assistant playback audio, and shows a small ephemeral Cookie whisper when Nova detects an English slip.

The earlier reviewed transcript flow is still retained in the repo as a fallback path for durable text turns, but it is not the headline demo.

## Why It Stands Out

- Technical implementation: the live loop combines Nova 2 Sonic speech streaming, live transcript rendering, whisper events, assistant audio playback, durable turn submission, recap generation, and translation.
- Creativity: the core idea is a two-agent recovery loop. Cookie repairs the slip. Cream resumes the conversation. That is more distinctive than a generic language tutor or voice chatbot.
- Impact: the product is designed around a real learning failure mode, helping speakers recover fast enough to stay in the target language instead of freezing or switching fully back to English.

## How Amazon Nova Is Used

Amazon Nova powers the parts of the product that need live voice, multilingual reasoning, and response control:

- `/api/live` uses Nova 2 Sonic over a bidirectional streaming session for live speech transcription.
- live whisper hints are derived on the backend from the live Sonic transcript stream using Nova on Bedrock and are sent to the client as ephemeral UI events.
- `/api/assistant-audio` streams Nova Sonic assistant speech audio for live-mode playback after `/api/turn` returns the durable assistant message.
- `/api/turn` uses Nova 2 Lite to route the learner turn to Cookie or Cream and generate the reply.
- `/api/recap` uses Nova 2 Lite to generate the session recap.
- `/api/translate` uses Nova 2 Lite to translate agent messages into learner-friendly English on demand.

If the backend Nova path fails, the app falls back to local logic so the demo still works.

## Live Demo Flow

The current Voice AI loop works like this:

- the learner speaks in Spanish
- the helper area shows the live Nova 2 Sonic transcript
- if the learner slips into English, Cookie whispers the smallest possible repair
- once the utterance is clean, the turn is submitted through `/api/turn`
- Cream continues the conversation naturally, with assistant playback streamed back to the browser
- the learner can finish with a recap or translate a Cream message on demand

## What Works Today

- live mode powered by Nova 2 Sonic streaming speech
- helper-area rendering of the current utterance during live capture
- ephemeral Cookie whisper hints in live mode
- streamed Nova Sonic assistant playback with browser speech synthesis fallback
- auto-submit gating after pause when no unresolved English slip remains
- durable learner turns through `/api/turn`
- session recap generation through `/api/recap`
- on-demand translation through `/api/translate`
- local fallback if backend requests fail
- scenario starters: Introduce yourself, Cafe order, Finding restaurant

## Architecture

```text
Live mode
  -> PCM mic audio
  -> WebSocket /api/live
  -> Amazon Nova 2 Sonic live transcript events
  -> ephemeral whisper events
  -> auto-submit only after final transcript + pause + no unresolved English slip
  -> POST /api/turn
  -> Amazon Nova 2 Lite routes Cookie or Cream
  -> POST /api/assistant-audio
  -> streamed Nova Sonic assistant playback + durable chat history

Reviewed fallback
  -> browser speech capture or typed input
  -> reviewed transcript
  -> POST /api/turn
  -> Amazon Nova 2 Lite routes Cookie or Cream
  -> durable chat history

Current conversation
  -> POST /api/recap
  -> Amazon Nova 2 Lite recap

Agent message
  -> POST /api/translate
  -> Amazon Nova 2 Lite translation
```

## Proof

Current validation:

- `npm test` passes with `92` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## Run Locally

```bash
nvm use
cp .env.example .env
npm install
npm run dev:full
```

Then open the frontend shown by Vite. The backend API runs on port `8787` by default. AWS credentials can come from env vars, a shared profile, or an attached role.

If you do not use `nvm`, install Node `20.20.0`.

## Continue On Another Computer

GitHub carries the tracked repo state, but not local secrets or machine setup. To resume quickly on another computer:

```bash
git clone https://github.com/hirooaoy/cookie-cream.git
cd cookie-cream
nvm use
cp .env.example .env
npm install
npm run dev:full
```

Move `.env` or AWS credentials separately because they are intentionally not committed.

If you want a new Codex session to pick up context fast, have it read:

- `AGENTS.md`
- `STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/ENGINEERING_NOTES.md`

## Manual Smoke Test

1. Allow microphone access in the browser and click `Start Live Practice`.
2. Choose `Cafe order`.
3. Tap the mic, say one all-Spanish turn, and verify the helper area shows the live utterance before Cream responds.
4. Tap the mic again, say a mixed Spanish and English turn, and verify Cookie whispers a repair.
5. Retry in Spanish and verify the durable turn submits only after the repaired utterance is clean.
6. Confirm the assistant reply plays back through Sonic audio, with browser speech synthesis as fallback if needed.
7. Request a session recap and translate a Cream message.

## Scope And Limitations

Implemented now:

- live Nova 2 Sonic speech streaming over WebSocket
- ephemeral live whisper coaching
- Sonic assistant audio streaming for live-mode playback
- reviewed transcript fallback implementation retained in the repo
- Nova-powered turn routing and replies
- Nova-powered recap and translation

Not built yet:

- persistent storage or multi-session history
- a broader always-on full-duplex production voice stack
