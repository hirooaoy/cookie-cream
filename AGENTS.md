# AGENTS.md

This file is the fast restart guide for Codex or any collaborator opening the repo on a new machine.

## Read In This Order

1. `README.md`
2. `STATUS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ENGINEERING_NOTES.md`

## Product Invariants

- Cookie & Cream is a voice-first Spanish practice app for English-speaking learners.
- The headline loop is live Nova 2 Sonic transcript -> ephemeral Cookie whisper -> Spanish retry -> durable turn -> Cream continues.
- Cookie only repairs slips. Cream owns the natural conversation.
- Keep fallback paths unless they are being replaced with something equally reliable.

## Local Setup

- Recommended Node version: `20.20.0`
- `cp .env.example .env`
- Provide AWS credentials through env vars, shared config, or an IAM role.
- `npm install`
- `npm run dev:full`

If you use `nvm`, run `nvm use` in the repo root first.

## Validation

- `npm test`
- `npm run build`
- `npm run eval:routes`

## High-Leverage Files

- `src/App.tsx`
- `src/live/useLivePractice.ts`
- `src/live/liveSonicClient.ts`
- `src/live/liveAssistantAudioPlayer.ts`
- `server/liveSonicSession.ts`
- `server/liveSonicRouter.ts`
- `server/novaTextTurn.ts`
- `server/assistantAudioService.ts`

## Cross-Machine Notes

- GitHub carries tracked files and commit history.
- `.env`, AWS credentials, browser mic permissions, `node_modules`, and local caches do not sync automatically.
- If Codex opens this repo without prior chat history, start by reading the files listed above.

## Handoff Rule

After a meaningful change, update `STATUS.md` with:

- what changed
- what was verified
- what still feels risky or unfinished
