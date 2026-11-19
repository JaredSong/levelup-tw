import { describe, expect, it } from 'vitest'
import { EN_PATH, GUIDE_PATH, examPageDescription, examPageTitle, examPath } from './seoUrls'

describe('public URL shapes', () => {
  it('uses the trailing-slash form Cloudflare Pages serves without a redirect', () => {
    expect(examPath('baking-food-c')).toBe('/exam/baking-food-c/')
    expect(EN_PATH).toBe('/en/')
    expect(GUIDE_PATH).toBe('/guide/')
  })

  it('keeps the question count in the exam title with fixed grouping', () => {
    expect(examPageTitle('烘焙食品丙級', 1187)).toBe('烘焙食品丙級學科題庫｜1,187 題線上測驗・PDF 下載 - 升級吧')
    expect(examPageTitle('網路架設丙級', 881)).toBe('網路架設丙級學科題庫｜881 題線上測驗・PDF 下載 - 升級吧')
  })

  it('leads the exam description with 線上測驗 and the PDF download, keeping code and count', () => {
    expect(examPageDescription('烘焙食品丙級', '07700', 1187)).toBe('烘焙食品丙級（07700）學科線上測驗與官方題庫 PDF 下載，共 1,187 題。免費練習、錯題自動複習、計時模擬考；免註冊、可離線，進度保存在裝置。')
  })
})
