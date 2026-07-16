import { describe, expect, it } from 'vitest'
import { zhTW } from './zh-TW'

describe('zh-TW interface copy', () => {
  it('uses Traditional Chinese as the primary shell language', () => {
    expect(zhTW.nav).toEqual({
      home: '首頁',
      practice: '練習',
      review: '複習',
      mock: '模擬',
      insights: '進度',
    })
  })

  it('names the full question bank clearly', () => {
    expect(zhTW.practice.allQuestionsTitle).toBe('全部題目')
    expect(zhTW.practice.searchPlaceholder).toBe('搜尋題號或題目')
  })

  it('keeps the public entry Chinese-first and exam-focused', () => {
    expect(zhTW.landing.brand).toBe('升級吧')
    expect(zhTW.landing.primaryAction).toBe('開始選考科')
    // Display headings all close with a full stop; this one used to be the odd one out.
    expect(zhTW.landing.examSectionTitle).toBe('選一科，馬上開始。')
  })

  it('states the bank size as a floor, so it cannot go stale as packs land', () => {
    expect(zhTW.landing.examSectionEyebrow(12_540)).toContain('12,000+ 題')
    expect(zhTW.landing.examSectionEyebrow(9_167)).toContain('9,000+ 題')
    // Below a thousand there is no floor to round to, so report the real count.
    expect(zhTW.landing.examSectionEyebrow(420)).toContain('420 題')
  })
})
