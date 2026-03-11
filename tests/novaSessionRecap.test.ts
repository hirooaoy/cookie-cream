import { describe, expect, it } from 'vitest'
import { __testables } from '../server/novaSessionRecap'

describe('novaSessionRecap helpers', () => {
  it('parses a strict recap payload', () => {
    const recap = __testables.parseRecapPayload(
      '{"didWell":["You kept trying in Spanish.","You retried after feedback.","You gave full answers."],"betterWay":"Instead of mixing in English, try: \\"Hoy hizo mucho calor.\\"","tryNext":"Try adding one more detail in Spanish."}',
    )

    expect(recap).toEqual({
      didWell: [
        'You kept trying in Spanish.',
        'You retried after feedback.',
        'You gave full answers.',
      ],
      betterWay: 'Instead of mixing in English, try: "Hoy hizo mucho calor."',
      tryNext: 'Try adding one more detail in Spanish.',
    })
  })

  it('rejects recap payloads with the wrong didWell count', () => {
    expect(() =>
      __testables.parseRecapPayload(
        '{"didWell":["One item.","Two items."],"betterWay":"Use more Spanish.","tryNext":"Try one follow-up question."}',
      ),
    ).toThrow('invalid recap payload')
  })

  it('flags recap items that are too long', () => {
    expect(
      __testables.validateRecap({
        didWell: [
          'You did a very impressive job keeping the conversation moving with many detailed ideas today.',
          'You retried after feedback.',
          'You gave full answers.',
        ],
        betterWay: 'Try: "Hoy hizo mucho calor."',
        tryNext: 'Add one follow-up question in Spanish.',
      }),
    ).toBe('didWell items must stay short.')
  })
})
