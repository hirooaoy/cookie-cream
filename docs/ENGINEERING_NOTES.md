# Engineering Notes

## Why Some Code Is Concentrated

Cookie & Cream was built as a hackathon project, but the current shape of the repo is
not accidental. The most complex logic is concentrated where iteration pressure was
highest:

- the live UI loop in `src/App.tsx`
- the live Sonic bridge in `server/liveSonicSession.ts`
- the routing and guardrail policy in `server/novaTextTurn.ts`

During the build, the hardest bugs were not isolated algorithm bugs. They were timing
bugs at the seams between transcript updates, whisper hints, assistant playback, and
durable turn submission. Keeping those seams visible in a small number of files made it
possible to debug the product quickly and keep the demo coherent.

## Deliberate Tradeoffs

These were intentional tradeoffs made for speed and demo reliability:

- prefer a few obvious orchestration files over early abstraction layers that would hide
  timing issues
- keep deterministic fallback paths for a narrow set of judged demo moments so one flaky
  transcript edge case does not break the core interaction
- validate and repair model output instead of assuming prompt-only control is enough for
  a role-sensitive two-agent product
- preserve older fallback paths in the repo while the live voice path became the primary
  story

None of that means the current layout is the final desired layout. It means the code was
optimized for iteration speed while the product idea was still being proven.

## What A Cleanup Pass Should Do

If this project continues after the hackathon, the most valuable cleanup work is:

1. Extract live dock and whisper presentation logic from `src/App.tsx` into smaller UI
   modules without changing visible behavior.
2. Separate transcript assembly, whisper scheduling, and transport plumbing inside
   `server/liveSonicSession.ts`.
3. Move Cookie/Cream decision policy into clearer rule modules while keeping the current
   validation rigor.
4. Add integration tests around the full live loop so later refactors can be bolder.

## What Should Not Be "Cleaned Up" Away

There are a few parts of the repo that may look defensive, but they are carrying product
requirements:

- strict validation between Cookie and Cream roles
- transcript version checks before clearing a whisper hint
- audio playback fallback that still preserves one UI playback state
- narrow deterministic assist logic around high-value demo phrases

Those are not random patches. They are the code paths that made the demo dependable.
