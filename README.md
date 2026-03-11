# Cookie & Cream

Cookie & Cream is a multimodal Spanish conversation coach for English-speaking learners. It turns spoken or typed practice into a reviewed transcript, uses Amazon Nova to decide how to respond, and keeps the learner in the flow when they slip back into English.

## Problem

Language learners often freeze when they switch languages mid-sentence. Most tools either correct them after the fact or turn the interaction into a grammar lesson.

That breaks the conversation right when the learner needs help recovering.

## Solution

Cookie & Cream uses a two-agent handoff:

- Cream is the Spanish conversation partner.
- Cookie appears only when the learner uses English, gives one better Spanish phrasing, and asks for a retry.

The learner can speak or type, review the transcript, send the turn, and finish with a short recap of what went well and what to try next.

## Why Amazon Nova

Amazon Nova powers the parts of the product that need multilingual reasoning and response control:

- `/api/turn` uses Nova 2 Lite to route the learner turn to Cookie or Cream and generate the reply.
- `/api/recap` uses Nova 2 Lite to generate the session recap.
- `/api/translate` uses Nova 2 Lite to translate agent messages into learner-friendly English on demand.

If the backend Nova path fails, the app falls back to local logic so the demo still works.

## Why This Fits Multimodal Understanding

The current working product combines multiple input and output modes in one loop:

- browser speech capture
- reviewed text transcript
- multilingual reasoning with Amazon Nova
- conversational coaching and recap output

This is not a live Nova 2 Sonic streaming app today. It is a speech-to-text-to-reasoning loop with a clear multimodal product flow.

## What Works Today

- browser speech capture with an editable transcript
- reviewed transcript turn submission through `/api/turn`
- two-agent handoff between Cream and Cookie
- session recap generation through `/api/recap`
- on-demand translation for Cookie and Cream messages through `/api/translate`
- Nova 2 Lite as the active backend model path
- local fallback if backend requests fail
- scenario starters: Introduce yourself, Cafe order, Finding restaurant

## Architecture

```text
Learner speech or typed input
  -> reviewed transcript
  -> POST /api/turn
  -> Amazon Nova 2 Lite routes Cookie or Cream
  -> coached reply in the transcript UI

Current conversation
  -> POST /api/recap
  -> Amazon Nova 2 Lite recap

Agent message
  -> POST /api/translate
  -> Amazon Nova 2 Lite translation
```

## Proof

Current validation in this repo:

- `npm test` passes with `36` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## Run Locally

```bash
npm install
npm run dev:full
```

Then open the frontend shown by Vite. The backend API runs on port `8787` by default.

## Current Scope

Implemented now:

- reviewed transcript flow
- browser speech capture
- Nova-powered turn routing and replies
- Nova-powered recap and translation

Not built yet:

- live Nova 2 Sonic voice streaming in the active user path
- backend audio session orchestration for Sonic
- persistent storage or multi-session history
- production-grade speech recognition
