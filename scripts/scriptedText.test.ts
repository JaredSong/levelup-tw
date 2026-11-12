import { describe, expect, it } from 'vitest'
import { restoreScriptedText, scriptInvariant } from './scriptedText.mjs'

// Word boxes as pdftotext -bbox prints them: 12pt body text, 6.96pt scripts.
const word = (x0: number, y0: number, x1: number, y1: number, text: string) =>
  `<word xMin="${x0}" yMin="${y0}" xMax="${x1}" yMax="${y1}">${text}</word>`
const page = (...words: string[]) => `<page width="595" height="842">\n${words.join('\n')}\n</page>`

describe('restoreScriptedText', () => {
  it('turns flattened exponents and subscripts back into scripts', () => {
    const bbox = page(
      word(283.85, 205.688, 332.138, 217.688, '①CuS(K'),
      word(333.19, 212.2424, 335.99968, 217.7624, 's'),
      word(336.90968, 212.2424, 340.11128, 217.7624, 'p'),
      word(341.23, 205.688, 374.47, 217.688, '=8×10'),
      word(375.55, 206.4152, 378.5776, 213.3752, '-'),
      word(379.63, 206.4152, 383.49976, 213.3752, '3'),
      word(384.54976, 206.4152, 388.41952, 213.3752, '7'),
      word(389.35, 205.688, 393.106, 217.688, ')'),
    )
    const result = restoreScriptedText('①CuS(K s p =8×10 - 3 7 )', bbox)
    expect(result.text).toBe('①CuS(Kₛₚ=8×10⁻³⁷)')
    expect(result.problems).toEqual([])
  })

  it('reads a leading superscript as a mass number and keeps real spaces', () => {
    const bbox = page(
      word(110.78, 511.138, 226.604, 523.138, '自然界中硼同位素有'),
      word(231.05, 511.8652, 234.91976, 518.8252, '1'),
      word(235.96976, 511.8652, 239.83952, 518.8252, '0'),
      word(240.77, 511.138, 248.294, 523.138, 'B'),
      word(252.53, 511.138, 264.53, 523.138, '及'),
    )
    expect(restoreScriptedText('自然界中硼同位素有 1 0 B 及', bbox).text).toBe('自然界中硼同位素有 ¹⁰B 及')
  })

  it('leaves full-size digits alone', () => {
    const bbox = page(word(110, 100, 150, 112, 'pH'), word(155, 100, 162, 112, '7'))
    expect(restoreScriptedText('pH 7', bbox).text).toBe('pH 7')
  })
})

describe('scriptInvariant', () => {
  it('only ignores script forms and whitespace', () => {
    expect(scriptInvariant('H₂SO₄ 10⁻⁵')).toBe(scriptInvariant('H 2 SO 4 10 - 5'))
    expect(scriptInvariant('H₂O')).not.toBe(scriptInvariant('H3O'))
  })
})
