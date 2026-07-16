import { describe, expect, it } from 'vitest'
import {
  buildDriftReport,
  hashInstalledOfficialDocuments,
  parseRocDate,
  parseWdaCatalogIndex,
  selectCurrentTheoryPdf,
} from './wdaCatalog.mjs'

const indexHtml = `
  <td id="17300" class="tdstyle"><span class='Roflabelup'>17300  網頁設計</span><br/>
    乙級 學科<a href="javascript:ShowKnowdiv('1150716','17300','2')">下載</a>
  </td>
  <td id="19500" class="tdstyle"><span class='Roflabelup'>19500  就業服務</span><br/>
    乙級 學科<a href="javascript:ShowKnowdiv('1150716','19500','2')">下載</a>
    學科<a href="javascript:ShowKnowdiv('1150716','19500','2')">新版</a>
  </td>`

const rows = [
  {
    PROFID: '19500', ROFNAME: '就業服務', PLATYPE: 'A', PLAFILETYPE: '1', MYLEVEL: '2',
    PLAFILE: '195002A16.pdf', PLAFNO: 16, PLAREMARK: '', Lang: '1', EnableDay: '1120824',
  },
  {
    PROFID: '19500', ROFNAME: '就業服務', PLATYPE: 'A', PLAFILETYPE: '1', MYLEVEL: '2',
    PLAFILE: '195002A17.pdf', PLAFNO: 17, PLAREMARK: '115/07/01起報檢者適用', Lang: '1', EnableDay: '1150701',
  },
  {
    PROFID: '90006', ROFNAME: '職業安全衛生共同科目', PLATYPE: 'A', PLAFILETYPE: '1', MYLEVEL: '0',
    PLAFILE: '900060A18.pdf', PLAFNO: 18, PLAREMARK: '', Lang: '1', EnableDay: '1150101',
  },
  {
    PROFID: '90006', ROFNAME: '職業安全衛生共同科目', PLATYPE: 'A', PLAFILETYPE: '1', MYLEVEL: '0',
    PLAFILE: '900060A19.mp3', PLAFNO: 19, PLAREMARK: '音訊檔', Lang: '1', EnableDay: '1150101',
  },
]

describe('WDA catalog parsing', () => {
  it('extracts and deduplicates official occupation-level queries', () => {
    expect(parseWdaCatalogIndex(indexHtml)).toEqual({
      effectiveRocDate: '1150716',
      entries: [
        { code: '17300', title: '網頁設計', levelCode: '2', level: '乙級' },
        { code: '19500', title: '就業服務', levelCode: '2', level: '乙級' },
      ],
    })
  })

  it('converts ROC dates and selects the newest effective Chinese PDF', () => {
    expect(parseRocDate('1150701')).toBe('2026-07-01')
    expect(selectCurrentTheoryPdf(rows, '19500', '2', '1150716')).toMatchObject({
      subjectCode: '19500',
      version: 'A17',
      pdfFilename: '195002A17.pdf',
      effectiveFrom: '2026-07-01',
      officialUrl: 'https://owinform.wdasec.gov.tw/owInform/DLowFile/195002A17.pdf',
    })
    expect(selectCurrentTheoryPdf(rows, '90006', '0', '1150716')?.pdfFilename).toBe('900060A18.pdf')
  })
})

describe('official drift report', () => {
  it('fails a pack when any occupation or shared source is stale', () => {
    const report = buildDriftReport(
      [{
        examId: 'employment-service-b',
        sources: [
          { subjectCode: '19500', pdfFilename: '195002A16.pdf', sha256: 'a'.repeat(64) },
          { subjectCode: '90006', pdfFilename: '900060A18.pdf', sha256: 'b'.repeat(64) },
        ],
      }],
      new Map([
        ['19500:2', { subjectCode: '19500', levelCode: '2', pdfFilename: '195002A17.pdf' }],
        ['90006:0', { subjectCode: '90006', levelCode: '0', pdfFilename: '900060A18.pdf' }],
      ]),
      new Map([['employment-service-b', '2']]),
    )

    expect(report.ok).toBe(false)
    expect(report.mismatches).toEqual([
      expect.objectContaining({
        examId: 'employment-service-b',
        subjectCode: '19500',
        installed: '195002A16.pdf',
        official: '195002A17.pdf',
      }),
    ])
  })

  it('rejects a successful HTML response instead of hashing it as a PDF', async () => {
    const documents = [{
      subjectCode: '17300', levelCode: '2', pdfFilename: '173002A13.pdf', officialUrl: 'https://example.test/173002A13.pdf',
    }]
    const manifests = [{
      examId: 'web-design-b',
      sources: [{ subjectCode: '17300', officialUrl: 'https://example.test/173002A13.pdf' }],
    }]
    const fakeFetch = async () => new Response('<html>maintenance</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })

    await expect(hashInstalledOfficialDocuments(documents, manifests, fakeFetch)).rejects.toThrow('not a PDF')
  })

  it('detects an official PDF replaced under the same filename', () => {
    const report = buildDriftReport(
      [{
        examId: 'web-design-b',
        sources: [{ subjectCode: '17300', pdfFilename: '173002A13.pdf', sha256: 'a'.repeat(64) }],
      }],
      new Map([['17300:2', {
        subjectCode: '17300',
        levelCode: '2',
        pdfFilename: '173002A13.pdf',
        sha256: 'b'.repeat(64),
      }]]),
      new Map([['web-design-b', '2']]),
    )

    expect(report.ok).toBe(false)
    expect(report.mismatches).toEqual([
      expect.objectContaining({
        examId: 'web-design-b',
        subjectCode: '17300',
        reason: 'sha256',
      }),
    ])
  })
})
