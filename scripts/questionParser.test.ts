import { describe, expect, it } from 'vitest'
import { parseQuestionBank } from './questionParser.mjs'

const sample = `17300 網頁設計 乙級 工作項目 01：作業準備
1. (1) 第一題？ ①甲 ②乙 ③丙 ④丁 。
2. (13) 複選題第一行
第二行？ ①選項一 ②選項二 ③選項三 ④選項四 。
Page 1 of 2\f17300 網頁設計 乙級 工作項目 02：應用軟體安裝及使用
1. (4) 如下圖，答案為何？ ①一 ②二 ③三 ④四 。`

describe('parseQuestionBank', () => {
  it('parses sections, answers, kinds, options, and source pages', () => {
    const result = parseQuestionBank(sample)

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      id: '17300-01-001',
      subjectCode: '17300',
      sourceGroup: 'occupation',
      section: '17300-01',
      sectionTitle: '作業準備',
      number: 1,
      kind: 'single',
      answers: [1],
      options: ['甲', '乙', '丙', '丁'],
      sourcePage: 1,
    })
    expect(result[1]).toMatchObject({
      kind: 'multiple',
      answers: [1, 3],
      prompt: '複選題第一行第二行？',
    })
    expect(result[2]).toMatchObject({
      id: '17300-02-001',
      sourcePage: 2,
      hasFigure: true,
    })
  })

  it('parses general and information-common subject headings with unique ids', () => {
    const common = `90006 職業安全衛生共同科目 不分級 工作項目 01：職業安全衛生
1. (2) 安全題？ ①甲 ②乙 ③丙 ④丁 。
90011 資訊相關職類共用工作項目 不分級 工作項目 01：電腦硬體架構
1. (1) 資訊題？ ①甲 ②乙 ③丙 ④丁 。`

    expect(parseQuestionBank(common)).toMatchObject([
      { id: '90006-01-001', subjectCode: '90006', sourceGroup: 'general-common' },
      { id: '90011-01-001', subjectCode: '90011', sourceGroup: 'information-common' },
    ])
  })

  it('parses class C occupation and beauty-hair common headings', () => {
    const hair = `06000 男子理髮 丙級 工作項目 01：毛髮與皮膚之認識
1. (1) 頭髮題？ ①甲 ②乙 ③丙 ④丁 。
90012 美容美髮相關職類安全衛生共同科目 不分級 工作項目 01：化粧品認識
1. (4) 安衛題？ ①甲 ②乙 ③丙 ④丁 。`

    expect(parseQuestionBank(hair)).toMatchObject([
      { id: '06000-01-001', subjectCode: '06000', sourceGroup: 'occupation', sectionTitle: '毛髮與皮膚之認識' },
      { id: '90012-01-001', subjectCode: '90012', sourceGroup: 'beauty-hair-common', sectionTitle: '化粧品認識' },
    ])
  })

  it('reports malformed questions instead of discarding them', () => {
    const malformed = `17300 網頁設計 乙級 工作項目 01：作業準備
1. (1) 選項不完整？ ①甲 ②乙 ③丙 。`

    expect(() => parseQuestionBank(malformed)).toThrow(/17300-01-001.*3 options/)
  })
})
