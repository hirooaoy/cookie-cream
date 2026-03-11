import { describe, expect, it } from 'vitest'
import { createAdaptiveCookieReply } from '../src/cookieCoach'

describe('adaptive Cookie coaching', () => {
  it('uses direct word replacement phrasing for common mixed English inserts', () => {
    const reply = createAdaptiveCookieReply({
      transcript: 'Ayer today hizo calor',
      betterSpanishPhrasing: 'Hoy hace un día caluroso.',
    })

    expect(reply).toContain('"today"')
    expect(reply).toContain('"hoy"')
    expect(reply).toContain('Hoy hace un día caluroso.')
  })

  it('falls back cleanly when there is no mapped English replacement', () => {
    const reply = createAdaptiveCookieReply({
      transcript: 'Ayer please hice ejercicio',
      betterSpanishPhrasing: 'Ayer hice ejercicio.',
    })

    expect(reply).toContain('"please"')
    expect(reply).toContain('Ayer hice ejercicio.')
  })

  it('recognizes common English venue phrases inside mixed turns', () => {
    const reply = createAdaptiveCookieReply({
      transcript: 'Hoy fui a Grocery Store',
      betterSpanishPhrasing: 'Hoy fui al supermercado.',
    })

    expect(reply).toContain('"Grocery Store"')
    expect(reply).toContain('"supermercado"')
    expect(reply).toContain('Hoy fui al supermercado.')
  })
})
