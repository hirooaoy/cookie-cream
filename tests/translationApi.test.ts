import { describe, expect, it } from 'vitest'
import { resolveLocalTranslation } from '../src/translationApi'

describe('local translation fallback', () => {
  it('translates common Cream prompts into English', () => {
    const result = resolveLocalTranslation({
      text: 'Hola. ¿Qué quieres pedir?',
      speaker: 'Cream',
      learnerLanguage: 'English',
      targetLanguage: 'Spanish',
    })

    expect(result.translation).toBe('Hi. What would you like to order?')
  })

  it('translates quoted Spanish examples inside Cookie coaching', () => {
    const result = resolveLocalTranslation({
      text: 'That was all English. In Spanish, say: "Hola." Try again.',
      speaker: 'Cookie',
      learnerLanguage: 'English',
      targetLanguage: 'Spanish',
    })

    expect(result.translation).toBe('That was all English. In Spanish, say: "Hi." Try again.')
  })
})
