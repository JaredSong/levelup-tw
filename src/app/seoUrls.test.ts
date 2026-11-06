import { describe, expect, it } from 'vitest'
import { EN_PATH, GUIDE_PATH, examPageTitle, examPath } from './seoUrls'

describe('public URL shapes', () => {
  it('uses the trailing-slash form Cloudflare Pages serves without a redirect', () => {
    expect(examPath('baking-food-c')).toBe('/exam/baking-food-c/')
    expect(EN_PATH).toBe('/en/')
    expect(GUIDE_PATH).toBe('/guide/')
  })

  it('keeps the question count in the exam title with fixed grouping', () => {
    expect(examPageTitle('烘焙食品丙級', 1187)).toBe('烘焙食品丙級學科題庫｜1,187 題免費線上練習 - 升級吧')
    expect(examPageTitle('網路架設丙級', 881)).toBe('網路架設丙級學科題庫｜881 題免費線上練習 - 升級吧')
  })
})
