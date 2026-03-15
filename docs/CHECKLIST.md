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
- why it belongs in `Voice AI`
- the loop: mic input -> live Nova 2 Sonic transcript -> Cookie whisper repair -> durable `/api/turn` -> Sonic assistant audio
- who it is for
- how Cream and Cookie differ
- what happens when the learner falls back to English
- how the reviewed transcript path remains the fallback architecture in the repo

## Demo Video

Show:
- idle app screen
- live listening state
- helper-area transcript rendering
- a normal Spanish turn
- a mixed-language slip
- Cookie whisper repair
- Spanish retry
- Cream continuation with assistant audio
- session recap
- optional translation of a Cream message

## Repo

Repo should include:
- runnable frontend and backend
- architecture documentation
- clear statement of the live primary path and the fallback path
- proof that the main path works

## Testing Instructions

Setup steps:

```bash
cp .env.example .env
npm install
npm run dev:full
```

Manual test instructions should include:
- make AWS credentials available through env vars, a shared profile, or an attached role
- allow microphone access in the browser
- click `Start Live Practice`
- choose `Cafe order`
- speak one all-Spanish turn and verify the helper area shows the live utterance before Cream responds
- speak one mixed Spanish and English turn and verify Cookie whispers a repair
- retry in Spanish and verify the durable turn submits only after the repaired utterance is clean
- verify assistant playback uses Sonic audio, with browser speech synthesis fallback if needed
- request a session recap
- translate a Cream message

Known current limitations to disclose:
- the app launches directly into the live voice path
- the reviewed transcript flow remains the fallback implementation in the repo
- there is no persistent history yet
- this is not a broader always-on production voice stack

## Screenshots Needed

- [ ] Main screen at idle
- [ ] Live listening state with helper transcript
- [ ] Cookie whisper intervention state
- [ ] Cream continuation state
- [ ] Session recap state
- [ ] Cream translation state

## Amazon Nova Explanation

The submission should explain:
- Nova 2 Sonic is the primary live model path today
- the app uses Nova 2 Sonic for live transcript events and assistant playback audio
- the app uses Amazon Nova to derive live whisper coaching from the transcript stream
- the app uses Nova 2 Lite for durable turn routing and reply generation
- the app uses Nova 2 Lite for recap generation
- the app uses Nova 2 Lite for on-demand translation
- the earlier reviewed transcript flow remains the fallback architecture in the repo

## Proof Points To Surface

Include these in the README or Devpost write-up:
- `npm test` passes with `72` tests
- `npm run build` passes
- `npm run eval:routes` passes `80/80` route checks on the Nova path

## Final Honesty Check

Before submitting, confirm the repo and write-up do not drift:
- [ ] Do say Nova 2 Sonic is the primary live path
- [ ] Do say durable turns still flow through `/api/turn`
- [ ] Do say the reviewed transcript path remains the fallback implementation in the repo
- [ ] Do not imply a broader always-on production voice stack than what is actually built
- [ ] Do not imply persistent history, analytics, or a visible mode toggle if those are not part of the shipped demo
