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
})
