# STATUS.md

Last updated: 2026-03-22

## Current Snapshot

- Branch: `main`
- Last pushed commit at the time of this snapshot: `3d030f0` (`Ship live Nova whisper demo flow`)
- Repo state when this file was written: clean working tree
- Last verified local toolchain: Node `v20.20.0`, npm `10.8.2`

## Product Reality

- This repo is no longer the older frontend-only prototype.
- The main demo is live and voice-first.
- `GET/WS /api/live` bridges browser PCM audio to Nova 2 Sonic and emits transcript plus whisper events.
- `POST /api/turn` uses Nova 2 Lite for durable Cookie/Cream routing and replies.
- `POST /api/assistant-audio` streams Nova Sonic assistant audio back to the client.
- `POST /api/recap` and `POST /api/translate` use Nova 2 Lite.
- Local fallback paths still exist for resilience when backend or model calls fail.

## Start Fresh On Another Computer

1. Clone the repo and pull `main`.
2. Run `nvm use` if available, or install Node `20.20.0`.
3. Copy `.env.example` to `.env`.
4. Provide AWS credentials via env vars, shared config, or an IAM role.
5. Run `npm install`.
6. Run `npm run dev:full`.
7. If you want Codex to regain context quickly, tell it to read `README.md`, `AGENTS.md`, `STATUS.md`, and `docs/ARCHITECTURE.md`.

## Validation Snapshot

Verified on this machine on 2026-03-22:

- `npm test` passes with `92` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

Update this section whenever those numbers change.

## Most Important Files

- Frontend orchestration: `src/App.tsx`
- Live transport and client state: `src/live/useLivePractice.ts`, `src/live/liveSonicClient.ts`, `src/live/liveAssistantAudioPlayer.ts`
- Backend live bridge: `server/liveSonicSession.ts`, `server/liveSonicRouter.ts`
- Turn policy: `server/novaTextTurn.ts`, `server/turnService.ts`
- Audio playback service: `server/assistantAudioService.ts`

## Likely Next Work

1. Break up `src/App.tsx` and `server/liveSonicSession.ts` without changing visible behavior.
2. Add integration coverage around the full live whisper loop.
3. Harden cross-browser microphone and audio failure handling.
4. Decide whether to keep the project as a stateless demo or add persistence.

## Known Gaps

- No persistent storage or multi-session history.
- No full production-grade always-on duplex voice stack.
- Some orchestration code is intentionally concentrated because that was the fastest way to stabilize the demo.
