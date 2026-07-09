import { describe, expect, it } from 'vitest'
import { chooseActiveExamId, formatExamSwitcherItem, INSTALLED_EXAMS } from './activeExam'

describe('active exam selection', () => {
  it('opens the saved exam when that exam is installed', () => {
    expect(chooseActiveExamId(INSTALLED_EXAMS, 'web-design-b')).toBe('web-design-b')
  })

  it('falls back to the first installed exam when the saved exam is missing', () => {
    expect(chooseActiveExamId(INSTALLED_EXAMS, 'missing-exam')).toBe('web-design-b')
  })

  it('returns null when no exams are installed', () => {
    expect(chooseActiveExamId([], 'web-design-b')).toBeNull()
  })

  it('formats installed exams for the switcher sheet', () => {
    expect(formatExamSwitcherItem(INSTALLED_EXAMS[0], true)).toEqual({
      examId: 'web-design-b',
      title: '網頁設計乙級',
      meta: '技能檢定 · 乙級 · A13',
      countLabel: '1,360 題可練習',
      statusLabel: '目前使用 · 離線',
    })
  })
})
