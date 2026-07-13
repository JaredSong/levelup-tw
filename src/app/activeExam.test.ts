import { describe, expect, it } from 'vitest'
import { chooseActiveExamId, formatCurrentBankLabel, formatExamSwitcherItem, INSTALLED_EXAMS } from './activeExam'

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

  it('formats the current bank label from the active exam instead of a fixed syllabus', () => {
    const womenHair = INSTALLED_EXAMS.find((exam) => exam.examId === 'women-hairdressing-c')!
    const employment = INSTALLED_EXAMS.find((exam) => exam.examId === 'employment-service-b')!

    expect(formatCurrentBankLabel(womenHair)).toBe('女子美髮丙級 A13')
    expect(formatCurrentBankLabel(employment)).toBe('就業服務乙級 A19')
  })
})
