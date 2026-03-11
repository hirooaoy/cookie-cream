export type AgentVoiceSpeaker = 'Cookie' | 'Cream'

type VoicePreferenceProfile = {
  fallbackLanguages: string[]
  preferredNameTokens: string[]
  avoidedNameTokens: string[]
}

const femaleVoiceTokens = [
  'female',
  'woman',
  'girl',
  'samantha',
  'victoria',
  'karen',
  'moira',
  'monica',
  'paulina',
  'paloma',
  'soledad',
  'elvira',
  'helena',
  'jenny',
  'aria',
  'olivia',
  'sofia',
  'maria',
  'carmen',
  'luna',
]

const maleVoiceTokens = [
  'male',
  'man',
  'boy',
  'daniel',
  'david',
  'guy',
  'alex',
  'fred',
  'jorge',
  'alvaro',
  'diego',
  'carlos',
  'matthew',
  'thomas',
  'sergio',
  'jaime',
  'rafael',
  'roger',
]

const voicePreferenceBySpeaker: Record<AgentVoiceSpeaker, VoicePreferenceProfile> = {
  Cream: {
    fallbackLanguages: ['es-ES', 'es-MX', 'es-US', 'es-419', 'es'],
    preferredNameTokens: femaleVoiceTokens,
    avoidedNameTokens: maleVoiceTokens,
  },
  Cookie: {
    fallbackLanguages: ['en-US', 'en-GB', 'en-AU', 'en'],
    preferredNameTokens: maleVoiceTokens,
    avoidedNameTokens: femaleVoiceTokens,
  },
}

export function selectPreferredVoice(
  voices: SpeechSynthesisVoice[],
  speaker: AgentVoiceSpeaker,
): SpeechSynthesisVoice | null {
  const preference = voicePreferenceBySpeaker[speaker]

  const rankedVoices = voices
    .map((voice) => ({
      voice,
      score: scoreVoice(voice, preference),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.voice.name.localeCompare(right.voice.name)
    })

  return rankedVoices[0]?.voice ?? null
}

function scoreVoice(voice: SpeechSynthesisVoice, preference: VoicePreferenceProfile) {
  const languageScore = scoreVoiceLanguage(voice, preference.fallbackLanguages)

  if (languageScore === 0) {
    return 0
  }

  return (
    languageScore +
    scoreVoicePersona(voice, preference.preferredNameTokens, preference.avoidedNameTokens) +
    (voice.default ? 2 : 0) +
    (!voice.localService ? 1 : 0)
  )
}

function scoreVoiceLanguage(voice: SpeechSynthesisVoice, fallbackLanguages: string[]) {
  const normalizedVoiceLanguage = voice.lang.trim().toLowerCase()
  let bestLanguageScore = 0

  fallbackLanguages.forEach((language, index) => {
    const normalizedPreference = language.toLowerCase()
    const matchScore = normalizedPreference.includes('-')
      ? normalizedVoiceLanguage === normalizedPreference
        ? 80 - index * 4
        : 0
      : normalizedVoiceLanguage === normalizedPreference || normalizedVoiceLanguage.startsWith(`${normalizedPreference}-`)
        ? 48 - index * 4
        : 0

    bestLanguageScore = Math.max(bestLanguageScore, matchScore)
  })

  return bestLanguageScore
}

function scoreVoicePersona(
  voice: SpeechSynthesisVoice,
  preferredNameTokens: string[],
  avoidedNameTokens: string[],
) {
  const normalizedDescriptor = `${voice.name} ${voice.voiceURI}`.toLowerCase()
  let personaScore = 0

  preferredNameTokens.forEach((token) => {
    if (normalizedDescriptor.includes(token)) {
      personaScore += token === 'female' || token === 'male' ? 26 : 18
    }
  })

  avoidedNameTokens.forEach((token) => {
    if (normalizedDescriptor.includes(token)) {
      personaScore -= token === 'female' || token === 'male' ? 24 : 16
    }
  })

  return personaScore
}
