# Cookie & Cream Plans

This file is the forward-looking roadmap. For the current checked-in state, read `README.md` and `STATUS.md` first.

## Snapshot

Product direction:
- Voice-first Spanish conversation coach for English-speaking intermediate learners
- Category target: Voice AI
- Core live model target: Amazon Nova 2 Sonic

Current repo reality:
- Vite + React + TypeScript frontend
- Node + TypeScript backend in `server/`
- Live Nova 2 Sonic path is the primary demo flow
- Nova 2 Lite handles durable turn routing, recap, and translation
- Reviewed transcript fallback remains in the repo as a backup path
- No persistent storage or multi-session history yet

## Current Status

Done:
- Live voice-first practice flow
- Browser mic capture streamed to `/api/live`
- Live Nova 2 Sonic transcript rendering
- Ephemeral Cookie whisper hints for English slips
- Durable turn submission through `/api/turn`
- Nova 2 Lite Cookie/Cream routing and reply generation
- Nova Sonic assistant audio playback path
- Recap and translation endpoints
- Local fallback behavior when backend or model calls fail

Not done:
- Persistent storage or multi-session history
- Full production-grade always-on duplex voice handling
- Broader analytics and learner progress tracking
- Cleanup of the largest orchestration files
- More end-to-end coverage around the full live loop

## Milestones

### Milestone 0: Live Demo Baseline
Status: Done

Scope:
- Preserve the current live whisper-recovery demo
- Keep backend and local fallback paths working

Validation:
```bash
npm install
nvm use
npm run build
npm test
npm run eval:routes
```

### Milestone 1: Live Loop Hardening
Status: Remaining

Scope:
- Reduce risk in the live transcript -> whisper -> submit -> playback loop
- Improve cross-browser microphone and assistant audio recovery
- Add stronger integration coverage around the timing-sensitive path

Validation:
```bash
npm test
npm run build
```

Manual checks:
- Live transcript appears while speaking
- English slips trigger Cookie whispers
- Clean Spanish retry auto-submits correctly
- Assistant audio still plays back or falls back cleanly

### Milestone 2: Targeted Refactor
Status: Remaining

Scope:
- Extract smaller modules from the biggest orchestration files
- Keep visible behavior unchanged while improving readability
- Preserve current fallback and validation behavior

Validation:
```bash
npm test
npm run build
```

Manual checks:
- Whisper timing and clearing still feel correct
- Cookie and Cream remain sharply separated
- Playback state does not regress during refactors

### Milestone 3: Persistence Decision
Status: Remaining

Scope:
- Decide whether to keep this as a stateless demo or add session persistence
- If persistence is added, introduce minimal storage for history and recap continuity
- Keep the core demo path simple and fast

Validation:
```bash
npm run build
```

Manual checks:
- Session continuity matches the chosen scope
- Recaps remain coherent after persistence changes

## Recommended Order

1. Harden the live loop
2. Refactor the highest-risk orchestration files carefully
3. Decide on persistence
4. Expand polish only after the main loop stays stable

## Notes

- The repo already demonstrates the live interaction pattern honestly.
- The biggest engineering risk is behavioral regression in the timing-sensitive live loop.
- `docs/ARCHITECTURE.md` and `docs/ENGINEERING_NOTES.md` explain why some logic is intentionally concentrated today.
