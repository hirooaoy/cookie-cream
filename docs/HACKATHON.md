# Hackathon Summary

## Category Recommendation

Submit as `Multimodal Understanding`.

Reason:
- the working product combines speech capture, reviewed text, multilingual reasoning, and coaching output
- the active Nova path today is Nova 2 Lite over reviewed transcript turns, recap, and translation
- this is a stronger fit than `Voice AI` while live Nova 2 Sonic streaming is not yet the shipped path

## Elevator Pitch

Cookie & Cream is a multimodal Spanish conversation coach for English-speaking learners. Cream keeps the conversation moving in Spanish, and Cookie steps in only when the learner slips into English so they can recover without losing the thread.

## Submission Angle

Frame the project around this problem:

- language learners often freeze when they switch languages mid-sentence
- most tools correct them after the fact instead of helping them recover inside the conversation

Frame the solution like this:

- the learner speaks or types
- the app creates a reviewed transcript
- Amazon Nova decides whether Cookie or Cream should respond
- Cookie gives one better Spanish phrasing when needed
- Cream continues the conversation naturally in Spanish

## Short Submission Blurb

Cookie & Cream helps English-speaking intermediate Spanish learners practice real conversation without breaking the flow when they slip into English. The learner can speak or type, review the transcript, and send the turn. Amazon Nova routes the turn to either Cream, the Spanish conversation partner, or Cookie, the English-speaking coach who gives one better Spanish phrasing and asks for a retry. The session can finish with a short recap and on-demand translation of agent messages.

## Key Features

- Two-agent handoff: Cream continues the Spanish conversation while Cookie handles recovery after an English slip.
- Reviewed transcript flow: the learner can speak, edit, and submit the transcript before the model responds.
- Session recap: the app generates three wins, one better phrasing, and one next step from the current conversation.
- On-demand translation: the learner can translate Cookie or Cream messages into English when needed.

## Why Judges May Care

- The Cookie and Cream handoff creates a clearer learning loop than a generic chatbot tutor.
- The product focuses on recovery after mistakes, which is a real pain point in language practice.
- The current repo is honest, testable, and easy to understand in a short demo.

## What The Repo Actually Does Today

Implemented now:
- browser speech capture with editable transcript
- backend turn submission through `/api/turn`
- backend session recap through `/api/recap`
- backend translation through `/api/translate`
- Nova 2 Lite as the active backend model path
- local fallback turn, recap, and translation logic
- scenario starters: Introduce yourself, Cafe order, Finding restaurant

This means the repo can honestly demo:
- a normal Spanish conversation turn
- an English or mixed-language slip
- Cookie coaching in English
- a Spanish retry
- Cream continuation in Spanish
- a short recap at the end of the session
- optional translation of agent messages for the learner

## Proof Points

Current local validation:
- `npm test` passes with `36` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## What Is Intentionally Out Of Scope Today

Not built yet:
- live Nova 2 Sonic voice streaming in the active user path
- production-grade speech recognition
- persistent history or database-backed sessions
- polished multi-session learning analytics

## Honest Model Story

Current active model path:
- reviewed transcript turns use Nova 2 Lite on the backend
- session recap uses Nova 2 Lite on the backend
- on-demand translation uses Nova 2 Lite on the backend

Future model path:
- live spoken interaction can move to Nova 2 Sonic when the app supports real backend audio sessions
- the repo already contains an experimental Sonic-oriented server path, but it is not the default user flow today
