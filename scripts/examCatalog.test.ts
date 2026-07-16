import { describe, expect, it } from 'vitest'
import { buildCatalogCoverage, parseTechcertiCatalog } from './examCatalog.mjs'

const catalogHtml = `
  <meta name="description" content="收錄甲級、乙級、丙級、單一級共 270 個技術士技能檢定職類">
  <p>完整收錄勞動部發行的 <strong>272</strong> 個技術士技能檢定職類學科題庫</p>
  <a class="exam-card" href="/exams/webdesignbeta">
    <span>乙級</span><span>17300</span>
    <h3 title="網頁設計">網頁設計</h3>
    <div><span>846 題</span><span>·</span><span>4 章節</span><span>·</span><span>版本 A13</span></div>
  </a>
  <a class="exam-card" href="/exams/babysitter">
    <span>單一級</span><span>15400</span>
    <h3 title="托育人員">托育人員</h3>
    <div><span>892 題</span><span>·</span><span>6 章節</span><span>·</span><span>版本 A17</span></div>
  </a>`

describe('parseTechcertiCatalog', () => {
  it('extracts rendered exam cards instead of trusting stale metadata totals', () => {
    const catalog = parseTechcertiCatalog(catalogHtml)

    expect(catalog.claimedTotal).toBe(272)
    expect(catalog.metadataTotal).toBe(270)
    expect(catalog.entries).toEqual([
      {
        slug: 'webdesignbeta',
        url: 'https://techcerti.bookmarks.tw/exams/webdesignbeta',
        level: '乙級',
        code: '17300',
        title: '網頁設計',
        questionCount: 846,
        sectionCount: 4,
        version: 'A13',
      },
      {
        slug: 'babysitter',
        url: 'https://techcerti.bookmarks.tw/exams/babysitter',
        level: '單一級',
        code: '15400',
        title: '托育人員',
        questionCount: 892,
        sectionCount: 6,
        version: 'A17',
      },
    ])
    expect(catalog.warnings).toContain('Rendered total 272 differs from metadata total 270.')
  })
})

describe('buildCatalogCoverage', () => {
  it('matches installed packs by official occupation code and level', () => {
    const catalog = parseTechcertiCatalog(catalogHtml)
    const coverage = buildCatalogCoverage(catalog, [
      { examId: 'web-design-b', level: '乙級', titleZh: '網頁設計乙級', version: 'A13', occupationCode: '17300' },
    ])

    expect(coverage.installedCount).toBe(1)
    expect(coverage.pendingCount).toBe(1)
    expect(coverage.entries[0]).toMatchObject({ code: '17300', installed: true, examId: 'web-design-b' })
    expect(coverage.entries[1]).toMatchObject({ code: '15400', installed: false })
  })
})
