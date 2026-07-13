import { describe, expect, it } from 'vitest'
import {
  chooseActiveExamId,
  formatCurrentBankLabel,
  formatExamSwitcherItem,
  formatMockFormatHint,
  formatSyllabusItems,
  homeStudyCopyForExam,
  INSTALLED_EXAMS,
} from './activeExam'

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

  it('formats syllabus items from the active exam manifest', () => {
    const employment = INSTALLED_EXAMS.find((exam) => exam.examId === 'employment-service-b')!
    const items = formatSyllabusItems(employment)

    expect(items.map((item) => item.code)).toEqual(['19500', '90006', '90007', '90008', '90009'])
    expect(items[0]).toMatchObject({
      code: '19500',
      label: '就業服務專業科目',
      meta: '1,214 題 · 3 個工作項目',
    })
    expect(items.find((item) => item.code === '90008')?.meta).toBe('95 題 · 環境保護')
  })

  it('formats mock rules from each exam manifest', () => {
    const employment = INSTALLED_EXAMS.find((exam) => exam.examId === 'employment-service-b')!
    const womenHair = INSTALLED_EXAMS.find((exam) => exam.examId === 'women-hairdressing-c')!

    expect(formatMockFormatHint(employment)).toBe('60 題單選 · 20 題複選 · 19500 專業科目 64 題 · 共同科目各 4 題')
    expect(formatMockFormatHint(womenHair)).toBe('80 題單選 · 06700 專業科目 60 題 · 共同科目各 4 題')
  })

  it('uses a law-heavy full-study-tool home copy for employment service', () => {
    const employment = INSTALLED_EXAMS.find((exam) => exam.examId === 'employment-service-b')!

    expect(homeStudyCopyForExam(employment)).toMatchObject({
      subtitle: '就服法規、勞動法令、職涯諮詢、人力仲介',
      shortSessionTitle: '以模擬分數當主指標。',
    })
  })
})
