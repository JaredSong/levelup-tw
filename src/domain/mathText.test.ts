import { describe, expect, it } from 'vitest'
import { hasMath, mathToPlain, parseMath, splitMath } from './mathText'

describe('mathText', () => {
  it('leaves text without ⟦ untouched', () => {
    const text = '下列何者為無理數？ $5 (a) x^2'
    expect(hasMath(text)).toBe(false)
    expect(splitMath(text)).toEqual([{ kind: 'text', text }])
    expect(mathToPlain(text)).toBe(text)
  })

  it('parses fractions, roots, powers and accents', () => {
    expect(parseMath('\\frac{1}{3}')).toEqual({ kind: 'frac', num: { kind: 'num', text: '1' }, den: { kind: 'num', text: '3' } })
    expect(parseMath('\\sqrt{3^{2}×4^{2}×6}')).toMatchObject({ kind: 'sqrt', body: { kind: 'row' } })
    expect(parseMath('\\overline{AB}')).toMatchObject({ kind: 'over', accent: 'overline' })
    expect(parseMath('\\sin A')).toEqual({ kind: 'row', children: [{ kind: 'fn', text: 'sin' }, { kind: 'ident', text: 'A' }] })
    expect(parseMath('cos^{2}θ')).toMatchObject({ kind: 'row', children: [{ kind: 'sup', base: { kind: 'fn', text: 'cos' } }, { kind: 'ident', text: 'θ' }] })
  })

  it('gives readable plain text for voice notes and search', () => {
    expect(mathToPlain('求 ⟦\\sqrt{3^{2}×4^{2}×6}⟧ 是')).toBe('求 √(3²×4²×6) 是')
    expect(mathToPlain('⟦-\\frac{14}{9}⟧')).toBe('-14/9')
    expect(mathToPlain('⟦\\frac{\\cos A}{1−\\sin A}⟧')).toBe('(cos A)/(1−sin A)')
    expect(mathToPlain('若 ⟦\\overline{AB}⟧＝⟦\\overline{AC}⟧')).toBe('若 A̅B̅＝A̅C̅')
    expect(mathToPlain('平均值（⟦\\bar{x}⟧）')).toBe('平均值（x̄）')
    expect(mathToPlain('⟦\\arc{AC}⟧')).toBe('弧AC')
  })

  it('refuses malformed math instead of showing it half-rendered', () => {
    expect(() => splitMath('⟦\\frac{1}⟧')).toThrow()
    expect(() => splitMath('⟦\\sqrt{2⟧')).toThrow()
    expect(() => splitMath('a ⟧ b')).toThrow()
    expect(() => splitMath('⟦\\frak{1}{2}⟧')).toThrow()
    expect(() => splitMath('⟦⟧')).toThrow()
  })
})
