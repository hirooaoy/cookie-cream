# Submission Checklist

## Required Materials

- [ ] Short text description of the project
- [ ] Demo video
- [ ] Public repo or repo access instructions
- [ ] Clear testing instructions
- [ ] Screenshots
- [ ] Explanation of how Amazon Nova is used

## Text Description

Include:
- what Cookie & Cream is
- why it belongs in `Multimodal Understanding`
- the loop: speech or typing -> reviewed transcript -> Nova reasoning -> coaching response
- who it is for
- how Cream and Cookie differ
- what happens when the learner falls back to English

## Demo Video

Show:
- idle app screen
- listening state
- transcript editing
- a normal conversation turn
- a fallback-to-English turn
- Cookie coaching
- retry
- Cream continuation
- session recap

## Repo

Repo should include:
- runnable frontend and backend
- architecture documentation
- clear statement of current state vs target state
- proof that the main path works

## Testing Instructions

Current repo commands:

```bash
npm install
npm run dev:full
npm run build
npm run eval:routes
```

Manual test instructions should include:
- allow microphone access in the browser
- try a voice turn
- edit the transcript manually
- press `Send`
- verify Cookie and Cream routing still works
- request a session recap
- try translating an agent message

Known current limitations to disclose:
- the active product mode is a reviewed transcript flow
- Nova 2 Sonic is not yet in the live turn path
- there is no persistent history yet

## Screenshots Needed

- [ ] Main screen at idle
- [ ] Listening state with live transcript
- [ ] Transcript populated and ready to send
- [ ] Cookie intervention state
- [ ] Cream continuation state
- [ ] Session recap state

## Amazon Nova Explanation

The submission should explain:
- Nova 2 Lite is the active backend model path today
- the app uses Nova for turn routing and reply generation
- the app uses Nova for recap generation
- the app uses Nova for on-demand translation
- Nova 2 Sonic is future work unless it becomes the real shipped path before submission

## Proof Points To Surface

Include these in the README or Devpost write-up:
- `npm test` passes with `36` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## Final Honesty Check

Before submitting, confirm the repo and write-up do not overclaim:
- [ ] Do not say Nova 2 Sonic is already running if it is not
- [ ] Do not call the current product live streaming if the learner still reviews the transcript before send
- [ ] Do say the repo already contains browser speech input, editable transcripts, Nova-powered turns, recap, and translation
