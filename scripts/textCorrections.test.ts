import { describe, expect, it } from 'vitest'
import { sanitizeText } from './textCorrections.mjs'

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
})
