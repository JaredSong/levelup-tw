import { describe, expect, it } from 'vitest'
import { buildDemandRanking, parseApplicantCsv } from './wdaDemand.mjs'

const csv = `\uFEFF職類名稱,細項職類名稱,級別,職類群,報檢人次,到檢人次,合格人次
007室內配線（屋內線路裝修）,00700室內配線（屋內線路裝修）,乙級,電機類群,3111,2871,1344
007室內配線（屋內線路裝修）,00700室內配線（屋內線路裝修）,丙級,電機類群,2673,2384,1367
151堆高機操作,15100堆高機操作,單一級,職業安全衛生操作類群,12000,11000,9000`

describe('WDA applicant statistics', () => {
  it('parses exact occupation codes and levels from the official CSV', () => {
    expect(parseApplicantCsv(csv)).toEqual([
      {
        code: '00700',
        title: '室內配線（屋內線路裝修）',
        level: '乙級',
        category: '電機類群',
        applicantCount: 3111,
        attendeeCount: 2871,
        passedCount: 1344,
      },
      {
        code: '00700',
        title: '室內配線（屋內線路裝修）',
        level: '丙級',
        category: '電機類群',
        applicantCount: 2673,
        attendeeCount: 2384,
        passedCount: 1367,
      },
      {
        code: '15100',
        title: '堆高機操作',
        level: '單一級',
        category: '職業安全衛生操作類群',
        applicantCount: 12000,
        attendeeCount: 11000,
        passedCount: 9000,
      },
    ])
  })

  it('ranks pending official catalog entries by exact code-level demand', () => {
    const ranking = buildDemandRanking(
      [
        { code: '00700', title: '室內配線', level: '乙級' },
        { code: '00700', title: '室內配線', level: '丙級' },
        { code: '15100', title: '堆高機操作', level: '單一級' },
      ],
      parseApplicantCsv(csv),
      new Set(['00700:乙級']),
    )

    expect(ranking.map((entry) => `${entry.code}:${entry.level}`)).toEqual([
      '15100:單一級',
      '00700:乙級',
      '00700:丙級',
    ])
    expect(ranking[0]).toMatchObject({ applicantCount: 12000, installed: false, demandRank: 1 })
    expect(ranking[1]).toMatchObject({ installed: true, demandRank: 2 })
  })
})
