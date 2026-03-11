import { describe, expect, it } from 'vitest'
import { getBubbleTextSegments } from '../src/messageText'

describe('message text styling', () => {
  it('italicizes English words in user messages only', () => {
    const segments = getBubbleTextSegments({
      speaker: 'User',
      text: 'Hola. iPhone cool',
    })

    expect(segments.filter((segment) => segment.isEnglish).map((segment) => segment.text)).toEqual([
      'iPhone',
      'cool',
    ])
  })

  it('only italicizes quoted English snippets in Cookie coaching', () => {
    const segments = getBubbleTextSegments({
      speaker: 'Cookie',
      text: 'You\'re close. "today" is "hoy" in Spanish. Say: "Me encanta el jugo."',
    })

    expect(segments.filter((segment) => segment.isEnglish).map((segment) => segment.text)).toEqual(['today'])
  })

  it('does not style Cream messages', () => {
    const segments = getBubbleTextSegments({
      speaker: 'Cream',
      text: 'Okay, cuéntame más.',
    })

    expect(segments.some((segment) => segment.isEnglish)).toBe(false)
  })
})
