# Devpost Submission Draft

## Judge / AI Summary

Cookie & Cream is a Voice AI Spanish conversation coach for English-speaking intermediate learners. The core idea is a two-agent whisper recovery loop: Cream keeps the conversation going in Spanish, and Cookie appears only when the learner slips into English mid-sentence, gives a quick repair, and disappears so the learner can keep talking. The live demo uses Amazon Nova 2 Sonic for live speech transcription and assistant audio playback, plus Nova 2 Lite for durable turn routing, recap, and translation.

## Recommended Title

Cookie & Cream

## Tagline

Recover mid-sentence and stay in Spanish with a live Nova Sonic whisper coach.

## Short Description

Cookie & Cream is a Voice AI Spanish coach that helps learners recover when they slip into English mid-sentence. Nova Sonic powers the live voice loop, Cookie whispers the fix, and Cream keeps the conversation moving.

## One-Sentence Pitch

Cookie & Cream helps English-speaking Spanish learners recover inside a live conversation instead of freezing the moment they slip into English.

## First Paragraph

Most language tools correct you after you stop talking. Cookie & Cream helps you recover before the conversation dies. Cream is the Spanish conversation partner. Cookie appears only when you slip into English, whispers the smallest possible fix, and gets out of the way so you can keep going. The live demo streams voice through Amazon Nova 2 Sonic, shows the current utterance in real time, and plays assistant responses back with voice so the whole loop stays conversational.

## Problem Statement

Language learners often do not fail after the sentence. They fail in the middle of it.

That is the moment when most apps become least helpful. They either interrupt with a full lesson, correct the learner after the conversation has already broken, or push them back into a passive study flow. The result is that learners freeze, switch fully back to English, or give up on the conversation entirely.

Cookie & Cream is built around that exact failure point. Instead of teaching after the moment is over, it helps the learner recover while the conversation is still alive.

## Solution

Cookie & Cream is a live conversational recovery coach for English-speaking intermediate Spanish learners.

The product has two roles:

- Cream is the natural Spanish conversation partner.
- Cookie is the whisper coach who appears only when the learner slips into English.

The core loop is:

1. The learner speaks in Spanish.
2. Amazon Nova 2 Sonic transcribes the utterance live.
3. If the learner slips into English, Cookie whispers a short Spanish repair.
4. The learner retries in Spanish.
5. Cream continues the conversation naturally.
6. The session can end with a short recap and optional translation support.

The key idea is that Cookie does not take over the conversation. Cookie fixes the slip, then Cream keeps the conversation alive.

## Why This Is A Strong Voice AI Entry

- It is voice-first, not text-first with voice bolted on.
- The most memorable product moment is live and category-native: the learner slips into English, Cookie whispers the fix, and the conversation continues.
- The demo uses a real Nova Sonic voice loop instead of only browser speech capture plus a later text response.
- The two-agent whisper recovery mechanic is more distinctive than a generic tutor chatbot or speaking-practice bot.

## How Amazon Nova Is Used

Amazon Nova powers both the live experience and the durable coaching flow:

- `Nova 2 Sonic` powers `/api/live` for live speech transcription.
- `Nova 2 Sonic` powers `/api/assistant-audio` for streamed assistant playback audio.
- Amazon Nova on Bedrock analyzes the live transcript stream and returns ephemeral Cookie whisper hints when the learner slips into English.
- `Nova 2 Lite` powers `/api/turn` for durable turn routing and response generation.
- `Nova 2 Lite` powers `/api/recap` for end-of-session recap generation.
- `Nova 2 Lite` powers `/api/translate` for on-demand translation support.

## Key Features

- Live Nova Sonic transcript loop over WebSocket.
- Real-time Cookie whisper repair during an English slip.
- Durable turn routing between Cookie and Cream.
- Streamed assistant audio playback for live responses.
- Session recap with wins, one better phrasing, and one next step.
- On-demand translation for extra learner support.
- Local fallback behavior if backend Nova calls fail.

## Technical Implementation

The live path works like this:

1. Browser microphone audio streams to `/api/live`.
2. The backend opens a Nova 2 Sonic session over WebSocket.
3. The UI renders the current utterance in real time.
4. If an English slip is detected, the backend emits a Cookie whisper event.
5. After the utterance is final and there is no unresolved slip, the turn is submitted through `/api/turn`.
6. Nova 2 Lite decides whether Cookie or Cream should respond and generates the durable text reply.
7. In live mode, `/api/assistant-audio` streams Nova Sonic audio back to the browser.

This keeps the product category-native while still preserving a reliable durable turn pipeline.

## Creativity

The novel mechanic is the two-agent whisper recovery loop.

Most language tools force a tradeoff between conversation and correction. Cookie & Cream splits those roles cleanly:

- Cookie handles the repair.
- Cream handles the conversation.

That makes the correction fast, focused, and temporary. The learner gets just enough help to recover without losing the social feeling of the conversation.

## Impact

Cookie & Cream is designed for a common and frustrating real-world moment: a learner knows enough Spanish to keep up until one missing phrase pushes them back into English.

By giving a quick repair inside the conversation instead of after it, the product aims to help learners:

- stay in the target language longer
- recover confidence faster after a mistake
- keep practicing conversation instead of falling into passive correction mode

This submission is strongest as a focused demo of that interaction. It does not yet claim long-term learning outcomes or large-scale analytics.

## What Works Today

- live Nova 2 Sonic speech streaming
- helper-area live transcript rendering
- ephemeral Cookie whisper hints
- streamed assistant audio playback
- durable turn routing through `/api/turn`
- session recap generation
- on-demand translation
- scenario starters for fast demos
- local fallback logic when backend requests fail

## Limitations

- no persistent storage or multi-session history yet
- no broad always-on production voice stack
- no polished progress dashboard yet
- the earlier reviewed transcript path is still kept in the repo as a fallback implementation, but the main demo is live voice first

## Proof Points

- `npm test` passes with `72` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## Testing Instructions

```bash
cp .env.example .env
npm install
npm run dev:full
```

Then:

1. Provide AWS credentials through environment variables, a shared profile, or an attached role.
2. Open the frontend shown by Vite and allow microphone access.
3. Click `Start Live Practice`.
4. Choose `Cafe order`.
5. Speak one all-Spanish turn and verify the helper area shows the live utterance before Cream responds.
6. Speak one mixed Spanish and English turn and verify Cookie whispers a repair.
7. Retry in Spanish and verify the turn submits only after the utterance is clean.
8. Confirm the assistant reply plays back through Sonic audio, with browser speech synthesis as fallback if needed.
9. Request a session recap and translate a Cream message.

## Suggested Devpost Sections

### Inspiration

Language learners often lose the conversation in the middle of a sentence, not after it. We wanted to build something that helps at the exact moment of failure instead of correcting the learner after the conversation is already broken.

### What It Does

Cookie & Cream is a live Spanish conversation coach for English-speaking learners. Cream is the conversation partner. Cookie appears only when the learner slips into English, whispers a quick Spanish repair, and then disappears so the learner can keep talking.

### How We Built It

We built the live voice loop around Amazon Nova 2 Sonic for speech transcription and assistant playback. We kept a durable turn pipeline through `/api/turn`, powered by Nova 2 Lite, to decide whether Cookie or Cream should respond and to generate the reply. We also use Nova 2 Lite for session recap and translation. The frontend is React + TypeScript, and the backend is a TypeScript Node server with a WebSocket bridge for the live Sonic session.

### Challenges We Ran Into

The main challenge was keeping the live voice experience responsive while still preserving a reliable durable turn flow. We also had to design the coaching behavior carefully so Cookie helped just enough to repair the slip without taking over the conversation.

### Accomplishments That We’re Proud Of

- Turning a common learning failure mode into a clear product interaction.
- Building a real Nova Sonic live voice loop instead of a text-first demo.
- Creating a two-agent system where correction and conversation stay separate.
- Keeping the repo runnable, testable, and honest about current scope.

### What We Learned

We learned that the most useful intervention is often the smallest one. A short whisper repair can be more valuable than a longer explanation if the goal is to keep the learner inside the conversation.

### What’s Next

- lightweight progress tracking such as slips caught, successful retries, and time spent in the target language
- user testing to measure how often learners recover within one retry
- broader language support beyond the current English-to-Spanish flow

## Video Script

### Intro

Most language tools correct you after you stop talking. Cookie & Cream helps you recover before the conversation dies.

Cream is the Spanish conversation partner. Cookie only appears when I slip into English and need a quick fix.

This live voice loop runs on Amazon Nova 2 Sonic.

### Outro

The new idea here is the whisper recovery loop: live voice, quick repair, then straight back to conversation.

Nova Sonic powers the live voice loop, Nova Lite handles the durable coaching flow, and Cookie & Cream is built to help learners stay in Spanish when it matters most: in the middle of the sentence.

## Optional Impact Upgrade Later

If you collect quick user-test data before submission, add one sentence like this near the top of the Devpost writeup:

`In early user testing, X out of Y learners recovered back into Spanish within one retry, and participants said the whisper fix felt faster and less disruptive than a full correction.`

Only use this after you have real numbers.
