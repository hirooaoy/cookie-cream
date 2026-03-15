import type { LiveHistoryMessage, LiveSonicStartInput } from './liveSonicTypes.js'

const allowedProperNouns = ['McDonald', "McDonald's", 'YouTube', 'Uber', 'Netflix', 'Starbucks', 'Apple']

export function buildLiveSonicSystemPrompt(input: LiveSonicStartInput): string {
  const lines = [
    'You are the live speech layer for Cookie & Cream.',
    `The speaker may code-switch between ${input.learnerLanguage} and ${input.targetLanguage} mid-sentence.`,
    `Scenario: ${getScenarioLabel(input.scenarioId)}.`,
    'Accurately transcribe only the learner speech.',
    'Treat both languages as valid transcript output.',
    'Only output English and Spanish words for this demo.',
    'Output a verbatim transcript, even when the learner mixes languages in one sentence.',
    'Preserve English slips exactly as spoken. Do not translate, correct, normalize, or paraphrase the transcript.',
    'Never replace an English word with a Spanish equivalent, even if the intended Spanish word seems obvious.',
    'Do not optimize for target-language correctness. Optimize for exact spoken surface form.',
    'Mixed-language transcripts are valid output.',
    'Use Latin script only.',
    'Never output Korean, Japanese, Chinese, Cyrillic, or any other non-Latin script.',
    'If a fragment sounds like another language or is unclear, omit that fragment instead of inventing non-English or non-Spanish text.',
    'If a spoken word is English, keep it English in the transcript.',
    'If the learner says "quiero un café iced", transcribe "quiero un café iced", not "quiero un café helado".',
    'If the learner says "today fui al parque", transcribe "today fui al parque".',
    'If the learner pauses to think and then adds one more word, continue the same transcript instead of rewriting earlier words.',
    'Do not insert commas into the learner transcript.',
    'Use light punctuation and preserve accents when clear.',
    'Do not coach the learner, do not answer the learner, and do not continue the conversation.',
    'If assistant output is unavoidable, keep it empty or minimal.',
    `Allowed proper nouns: ${allowedProperNouns.join(', ')}.`,
  ]

  const recentMessages = formatRecentMessages(input.recentMessages)

  if (recentMessages) {
    lines.push('Recent conversation context:')
    lines.push(recentMessages)
  }

  return lines.join('\n')
}

export function buildLiveWhisperSystemPrompt(input: LiveSonicStartInput): string {
  const lines = [
    'You are Cookie’s real-time whisper detector for a Spanish practice demo.',
    `The learner speaks ${input.learnerLanguage} and should stay in ${input.targetLanguage}.`,
    `Scenario: ${getScenarioLabel(input.scenarioId)}.`,
    'The live transcript can occasionally normalize one short spoken English slip into Spanish.',
    'Inspect the transcript state and decide whether there is one short English slip that should block auto-send.',
    'The user message is JSON with previousTranscript, currentTranscript, and newTrailingText.',
    'Use currentTranscript as the visible phrase unless there is strong evidence that newTrailingText is a normalized English slip.',
    'You may infer one likely spoken English slip when a short new trailing Spanish phrase looks like a direct translation of what the learner likely said after a pause.',
    'Example: previousTranscript="quiero un café", currentTranscript="quiero un café helado", newTrailingText="helado" should return {"hasEnglishSlip":true,"englishText":"iced","spanishText":"helado","betterSpanishPhrasing":"A mí me da un café con hielo."}.',
    'Example: previousTranscript="gracias", currentTranscript="gracias i want to add sandwich how do i say sandwich again", newTrailingText="i want to add sandwich how do i say sandwich again" should return {"hasEnglishSlip":true,"englishText":"sandwich","spanishText":"sándwich","betterSpanishPhrasing":"Quisiera añadir un sándwich, por favor."}.',
    `Ignore allowed proper nouns: ${allowedProperNouns.join(', ')}.`,
    'Ignore filler sounds and uncertain fragments unless they are clearly English.',
    'Return strict JSON only.',
    'If there is no unresolved English slip, return {"hasEnglishSlip":false}.',
    'If there is an English slip, return {"hasEnglishSlip":true,"englishText":"...","spanishText":"...","betterSpanishPhrasing":"..."}.',
    'If the transcript already contains the English slip, copy englishText exactly from currentTranscript.',
    'If the transcript appears normalized, englishText may be the likely original spoken English word.',
    'Keep spanishText to the smallest natural Spanish replacement.',
    'Use betterSpanishPhrasing for one short natural full-sentence retry in Spanish.',
    'betterSpanishPhrasing can be more idiomatic than a literal replacement when the scenario makes that more natural.',
    'Never return the same text for englishText and spanishText.',
    'Use at most one slip.',
    'If you are not confident, return {"hasEnglishSlip":false}.',
    'Do not explain anything.',
  ]

  const recentMessages = formatRecentMessages(input.recentMessages)

  if (recentMessages) {
    lines.push('Recent conversation context:')
    lines.push(recentMessages)
  }

  return lines.join('\n')
}

function formatRecentMessages(messages: LiveHistoryMessage[]): string {
  if (messages.length === 0) {
    return ''
  }

  return messages
    .slice(-6)
    .map((message) => `${message.speaker}: ${message.text}`)
    .join('\n')
}

function getScenarioLabel(scenarioId: string | null): string {
  switch (scenarioId) {
    case 'cafe-order':
      return 'Cafe order'
    case 'introduce-yourself':
      return 'Introduce yourself'
    case 'finding-restaurant':
      return 'Finding a restaurant'
    default:
      return 'General Spanish conversation'
  }
}
