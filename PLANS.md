# Cookie & Cream Plans

## Snapshot

Product direction:
- Voice-first Spanish conversation coach for English-speaking intermediate learners
- Category target: Voice AI
- Core model target: Amazon Nova 2 Sonic

Current repo reality:
- Frontend-only Vite + React + TypeScript prototype
- Voice-first dock with editable transcript in the browser
- Browser speech recognition via the Web Speech API
- Local turn logic in `src/prototype.ts`
- No backend, no database, no Nova 2 Sonic in the core turn path
- Current fallback copy and routing examples are still Japanese/English, not yet Spanish-focused

## Current Status

Done:
- Minimal single-screen app scaffold
- Conversation transcript UI
- Cookie/Cream avatars and chat layout
- Editable transcript input
- Browser speech capture
- Local submit path into `submitUserTurn(...)`
- Local Cookie/Cream fallback behavior

Not done:
- Spanish retarget of the local fallback logic and copy
- Backend session/service layer
- Nova 2 Sonic in the primary speech turn path
- Production speech stack beyond browser Web Speech API
- Submission assets and polished demo flow

## Milestones

### Milestone 0: Current Prototype Baseline
Status: Done

Scope:
- Preserve the current browser-only prototype
- Keep local turn logic as a fallback baseline

Validation:
```bash
npm install
npm run build
npm run dev
```

### Milestone 1: Spanish Retarget
Status: Remaining

Scope:
- Replace Japanese-first fallback logic and demo copy with Spanish-first content
- Keep the same Cookie/Cream interaction model
- Keep local fallback logic for development until Nova is wired in

Validation:
```bash
npm run build
```

Manual checks:
- Typed Spanish stays with Cream
- English fallback triggers Cookie
- Retry in Spanish returns to Cream
- Voice transcript can still be edited before send

### Milestone 2: Nova 2 Sonic in the Core Turn Path
Status: Remaining

Scope:
- Add a backend service for turn handling
- Put Amazon Nova 2 Sonic on the primary speech path
- Move the live conversation turn out of browser-only heuristics
- Keep local fallback logic as a dev/demo safety net

Validation:
```bash
npm run build
```

Backend validation target:
```bash
# exact command TBD once backend exists
```

Manual checks:
- Spoken input reaches the backend
- Nova 2 Sonic is used for the main turn path
- Cookie/Cream routing still matches product rules

### Milestone 3: Demo Hardening
Status: Remaining

Scope:
- Clean up copy, screenshots, and demo script
- Prepare submission narrative around Voice AI + Nova 2 Sonic
- Add error handling and fallback behavior for unsupported speech browsers

Validation:
```bash
npm run build
```

Manual checks:
- 3-minute demo can be run without code edits
- Screenshots match the current product story
- Repo instructions are accurate

## Recommended Order

1. Retarget the local prototype from Japanese to Spanish
2. Add the backend turn service
3. Put Nova 2 Sonic into the core turn path
4. Harden the demo and submission materials

## Notes

- The repo already demonstrates the interaction pattern and the voice-first UI.
- The main compliance gap is that the core turn path is still local/browser-driven rather than Nova 2 Sonic-driven.
- The biggest narrative gap is that the repo implementation still contains Japanese-specific fallback logic while the project direction is now Spanish.
