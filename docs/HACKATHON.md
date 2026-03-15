# Hackathon Summary

## Category Recommendation

Submit as `Voice AI`.

Reason:
- the primary demo path is a live Amazon Nova 2 Sonic conversation loop
- the most memorable product moment is a real-time Cookie whisper repair during a live spoken turn
- assistant replies play back through streamed Sonic audio after the durable turn is committed
- the earlier reviewed transcript flow remains in the repo as fallback architecture, but live voice is the shipped story

## Elevator Pitch

Cookie & Cream is a real-time conversational recovery coach for English-speaking Spanish learners. Cream keeps the conversation moving in Spanish, and Cookie appears only when the learner slips into English so they can recover inside the moment instead of freezing.

## Submission Angle

Frame the problem like this:

- language learners do not fail after the sentence, they fail in the middle of it
- most tools correct them after the fact instead of helping them recover while the conversation is still alive

Frame the solution like this:

- the learner speaks into a live Nova 2 Sonic session
- the current utterance appears immediately in the helper area
- if the learner slips into English, Cookie whispers one short Spanish repair
- once the turn is clean, the transcript is submitted through the durable `/api/turn` path
- Cream or Cookie responds in text, and the live path streams Sonic assistant audio back to the browser
- the session can end with a short recap and optional translation support

## Short Submission Blurb

Cookie & Cream is a Voice AI conversation coach for English-speaking intermediate Spanish learners. The live demo streams microphone audio into Amazon Nova 2 Sonic, renders the current utterance in real time, and shows a brief Cookie whisper when the learner slips into English mid-sentence. Once the learner retries in Spanish, the durable turn is submitted through `/api/turn`, Cream continues the conversation naturally, and the assistant reply plays back through streamed Sonic audio. The session can finish with a short recap and on-demand translation of Cream messages.

## Key Features

- Live Nova 2 Sonic transcript loop over WebSocket.
- Real-time Cookie whisper repair when the learner mixes in English.
- Durable turn routing and reply generation through `/api/turn`.
- Streamed Nova Sonic assistant audio playback for live-mode responses.
- Session recap and on-demand translation powered by Amazon Nova.
- Reviewed transcript fallback architecture retained in the repo.

## Why Judges May Care

- The product is voice-first and category-native instead of being a text tutor with voice bolted on.
- The Cookie and Cream handoff creates a memorable two-agent learning loop.
- The app solves a specific failure point: recovering mid-sentence instead of restarting after the conversation breaks.
- The repo now explains the live path, fallback path, and Amazon Nova usage quickly enough for async judging.

## What The Repo Actually Does Today

Implemented now:
- live mode powered by Nova 2 Sonic streaming speech over `/api/live`
- helper-area rendering of the current live utterance
- ephemeral Cookie whisper hints during an English slip
- auto-submit gating after a final transcript plus pause when no unresolved slip remains
- durable turn submission through `/api/turn`
- streamed Sonic assistant playback through `/api/assistant-audio`
- session recap generation through `/api/recap`
- on-demand translation through `/api/translate`
- local fallback logic if backend requests fail
- reviewed transcript fallback path retained in the repo
- scenario starters: Introduce yourself, Cafe order, Finding restaurant

## Manual Test Path

Use this as the demo and judge-testing path:

1. Start the app with AWS credentials available through env vars, a shared profile, or an attached role.
2. Open the frontend, allow microphone access, and click `Start Live Practice`.
3. Choose `Cafe order`.
4. Tap the mic, speak a full Spanish turn, and verify the helper area shows the live transcript before Cream responds.
5. Speak a mixed Spanish and English turn and verify Cookie whispers a short repair.
6. Retry in Spanish and verify the durable turn is submitted only after the repaired utterance is clean.
7. Confirm the assistant reply plays back through Sonic audio, with browser speech synthesis as fallback.
8. Request a session recap and translate a Cream message.

## Proof Points

Current local validation:
- `npm test` passes with `72` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## Honest Model Story

Primary live model path:
- `/api/live` uses Nova 2 Sonic for live speech transcription
- live whisper analysis uses Amazon Nova on Bedrock and returns ephemeral whisper events
- `/api/assistant-audio` uses Nova 2 Sonic for live assistant playback
- `/api/turn` uses Nova 2 Lite for durable turn routing and text generation
- `/api/recap` uses Nova 2 Lite for session recap generation
- `/api/translate` uses Nova 2 Lite for on-demand translation

Fallback behavior:
- if the backend Nova path fails, the app falls back to local logic so the demo stays testable
- the earlier reviewed transcript flow remains the fallback implementation in the repo

## What Is Intentionally Out Of Scope Today

Not built yet:
- persistent storage or multi-session history
- a broader always-on full-duplex production voice stack
- polished multi-session progress analytics
