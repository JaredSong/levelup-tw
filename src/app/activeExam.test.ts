import { describe, expect, it } from 'vitest'
import {
  chooseActiveExamId,
  chooseSelectedExamIds,
  formatCurrentBankLabel,
  formatExamCatalogCode,
  formatExamSwitcherItem,
  formatMockFormatHint,
  formatSyllabusItems,
  groupExamsByCategory,
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

  it('keeps the subject switcher scoped to selected exams and the active exam', () => {
    const exams = [
      { examId: 'web-design-b' },
      { examId: 'employment-service-b' },
      { examId: 'missing-from-catalog' },
    ]

    expect(chooseSelectedExamIds(exams, ['employment-service-b', 'employment-service-b', 'unknown'], 'web-design-b')).toEqual([
      'web-design-b',
      'employment-service-b',
    ])
  })

  it('defaults selected exams to only the active exam when nothing was chosen yet', () => {
    expect(chooseSelectedExamIds(INSTALLED_EXAMS, null, 'employment-service-b')).toEqual(['employment-service-b'])
  })

  it('formats installed exams for the switcher sheet', () => {
    expect(formatExamSwitcherItem(INSTALLED_EXAMS[0], true)).toEqual({
      examId: 'web-design-b',
      title: '網頁設計乙級',
      meta: '資訊 · 乙級 · A13',
      countLabel: '1,360 題可練習',
      statusLabel: '目前使用 · 離線',
    })
  })

  it('shows only the occupation code and pack version in catalog cards', () => {
    expect(formatExamCatalogCode(INSTALLED_EXAMS[0])).toBe('17300 · A13')

    const software = INSTALLED_EXAMS.find((exam) => exam.examId === 'computer-software-application-c')!
    expect(formatExamCatalogCode(software)).toBe('11800 · A14')
  })

  it('keeps the web design manifest generated data as the UI source of truth', () => {
    const webDesign = INSTALLED_EXAMS[0]
    expect(webDesign.category).toBe('資訊')
    expect(webDesign.officialLinks).toMatchObject({
      handbook: 'https://skill.tcte.edu.tw/download.php',
      questionBank: 'https://techbank.wdasec.gov.tw/',
      registration: 'https://skill.tcte.edu.tw/notice.php',
      scoreLookup: 'https://eservice.wdasec.gov.tw/',
    })
    expect(webDesign.sections.find((section) => section.id === '17300-03')?.activeQuestionCount).toBe(124)
    expect(webDesign.sections.find((section) => section.id === '17300-04')?.activeQuestionCount).toBe(75)
  })

  it('includes the high-demand class C packs in the searchable catalog', () => {
    expect(INSTALLED_EXAMS.map((exam) => exam.examId)).toEqual(expect.arrayContaining([
      'computer-software-application-c',
      'chinese-cooking-meat-c',
      'baking-food-c',
      'car-repair-c',
      'beauty-c',
      'accounting-c',
      'childcare-single',
      'care-service-single',
      'occupational-safety-health-management-b',
      'forklift-operation-single',
      'interior-decoration-management-b',
      'beverage-preparation-c',
    ]))
  })

  it('groups the subject catalog by professional category while preserving exam order', () => {
    const groups = groupExamsByCategory(INSTALLED_EXAMS)

    expect(groups.map((group) => group.category)).toEqual([
      '資訊',
      '美容美髮',
      '商業服務',
      '餐飲食品',
      '車輛修護',
      '照護服務',
      '職業安全衛生',
      '機械操作',
      '營造工程',
    ])
    expect(groups.find((group) => group.category === '資訊')?.exams.map((exam) => exam.examId)).toEqual([
      'web-design-b',
      'computer-software-application-c',
    ])
    expect(groups.find((group) => group.category === '餐飲食品')?.exams.map((exam) => exam.examId)).toEqual([
      'chinese-cooking-meat-c',
      'baking-food-c',
      'beverage-preparation-c',
    ])
    expect(groups.find((group) => group.category === '車輛修護')?.exams.map((exam) => exam.examId)).toEqual([
      'car-repair-c',
    ])
  })

  it('formats the current bank label from the active exam instead of a fixed syllabus', () => {
    const womenHair = INSTALLED_EXAMS.find((exam) => exam.examId === 'women-hairdressing-c')!
    const employment = INSTALLED_EXAMS.find((exam) => exam.examId === 'employment-service-b')!

    expect(formatCurrentBankLabel(womenHair)).toBe('女子美髮丙級 A13')
    expect(formatCurrentBankLabel(employment)).toBe('就業服務乙級 A17')
  })

  it('formats syllabus items from the active exam manifest', () => {
    const employment = INSTALLED_EXAMS.find((exam) => exam.examId === 'employment-service-b')!
    const items = formatSyllabusItems(employment)

    expect(items.map((item) => item.code)).toEqual(['19500', '90006', '90007', '90008', '90009'])
    expect(items[0]).toMatchObject({
      code: '19500',
      label: '就業服務專業科目',
      meta: '1,250 題 · 3 個工作項目',
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
