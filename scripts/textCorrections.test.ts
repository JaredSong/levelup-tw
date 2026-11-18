import { describe, expect, it } from 'vitest'
import { rootsToMath, sanitizeText } from './textCorrections.mjs'

describe('sanitizeText', () => {
  it('repairs known extraction splits without broad guessing', () => {
    expect(sanitizeText('$_SESSIO N and Dept_na me with mys ql_close')).toBe(
      '$_SESSION and Dept_name with mysql_close',
    )
    expect(sanitizeText('PM 2 . 5, 15μg/m 3, and W/m 2')).toBe(
      'PM2.5, 15μg/m³, and W/m²',
    )
    expect(sanitizeText('TRUE ANDSUM (Salary)')).toBe('TRUE AND SUM (Salary)')
    expect(sanitizeText('Mod ulation, Presentat ion Layer, Medium-Term Schedu ler')).toBe(
      'Modulation, Presentation Layer, Medium-Term Scheduler',
    )
    expect(sanitizeText('Mutual Exc lusion, dis play, Goo gle, Apa che Server, Uni cast')).toBe(
      'Mutual Exclusion, display, Google, Apache Server, Unicast',
    )
  })

  it('leaves ambiguous table and hexadecimal-looking values untouched', () => {
    expect(sanitizeText('E 1, X 1, 3 x 3, AFCB DE')).toBe(
      'E 1, X 1, 3 x 3, AFCB DE',
    )
  })

  it('removes PDF extraction spaces inside Traditional Chinese prose', () => {
    expect(sanitizeText('下列何者正 確？可 以避免損 耗。')).toBe('下列何者正確？可以避免損耗。')
    expect(sanitizeText('在 Microsoft Word 環境')).toBe('在 Microsoft Word 環境')
  })
})

describe('rootsToMath', () => {
  it('draws the radicand under the root bar, as the paper prints it', () => {
    expect(rootsToMath('③√2 IL')).toBe('③⟦\\sqrt{2}⟧ IL')
    expect(rootsToMath('20″√N＋5')).toBe('20″⟦\\sqrt{N}⟧＋5')
    expect(rootsToMath('f＝1/(2π√LC)')).toBe('f＝1/(2π⟦\\sqrt{LC}⟧)')
    expect(rootsToMath('√(R² + (X_L + X_C)²)')).toBe('⟦\\sqrt{R^{2} + (X_{L} + X_{C})^{2}}⟧')
  })
  it('leaves math and root-free text alone, and is idempotent', () => {
    expect(rootsToMath('⟦\\sqrt{2}\\pi⟧ 倍')).toBe('⟦\\sqrt{2}\\pi⟧ 倍')
    expect(rootsToMath('無根號')).toBe('無根號')
    expect(rootsToMath(rootsToMath('√3EI'))).toBe('⟦\\sqrt{3}⟧EI')
  })
})
