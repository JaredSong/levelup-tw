import { describe, expect, it } from 'vitest'
import {
  auditCandidate,
  buildCandidateConfig,
  findOfficialDocument,
  parseExamSpecifier,
} from './batchImport.mjs'

describe('parseExamSpecifier', () => {
  it('accepts compact WDA code plus level', () => {
    expect(parseExamSpecifier('028003')).toEqual({
      input: '028003',
      subjectCode: '02800',
      levelCode: '3',
      level: '丙級',
    })
  })

  it('accepts an explicit code:level form', () => {
    expect(parseExamSpecifier('00700:2')).toEqual({
      input: '00700:2',
      subjectCode: '00700',
      levelCode: '2',
      level: '乙級',
    })
  })

  it('rejects ambiguous or unsupported identifiers', () => {
    expect(() => parseExamSpecifier('02800')).toThrow('Expected')
    expect(() => parseExamSpecifier('028005')).toThrow('Expected')
  })
})

describe('findOfficialDocument', () => {
  it('resolves the exact level-specific WDA paper', () => {
    const catalog = {
      documents: [
        { subjectCode: '00700', levelCode: '2', pdfFilename: '007002A15.pdf' },
        { subjectCode: '00700', levelCode: '3', pdfFilename: '007003A13.pdf' },
      ],
    }

    expect(findOfficialDocument(catalog, parseExamSpecifier('007003'))?.pdfFilename).toBe('007003A13.pdf')
  })
})

describe('auditCandidate', () => {
  const questions = [
    {
      id: '02800-01-001',
      subjectCode: '02800',
      section: '02800-01',
      sectionTitle: '基本電子學',
      number: 1,
      kind: 'single',
      prompt: '如下圖，何者正確？',
      options: ['甲', '乙', '丙', '丁'],
      answers: [2],
      sourcePage: 2,
      hasFigure: true,
    },
    {
      id: '02800-01-002',
      subjectCode: '02800',
      section: '02800-01',
      sectionTitle: '基本電子學',
      number: 2,
      kind: 'multiple',
      prompt: '本題刪題',
      options: ['甲', '乙', '丙', '丁'],
      answers: [1, 3],
      sourcePage: 3,
      hasFigure: false,
    },
  ]

  it('summarises answer integrity and sends risky pages to review', () => {
    const audit = auditCandidate({
      subjectCode: '02800',
      questions,
      officialKeys: new Map([
        ['01-1', [2]],
        ['01-2', [1, 3]],
      ]),
    })

    expect(audit.status).toBe('review_required')
    expect(audit.questionCount).toBe(2)
    expect(audit.multipleCount).toBe(1)
    expect(audit.answerIntegrity).toEqual({ checked: 2, agreed: 2, mismatches: [], unmatched: [] })
    expect(audit.deletionCandidates).toEqual(['02800-01-002'])
    expect(audit.reviewQueue).toEqual([
      expect.objectContaining({ page: 2, questionIds: ['02800-01-001'], reasons: ['figure'] }),
      expect.objectContaining({ page: 3, questionIds: ['02800-01-002'], reasons: ['deletion-marker'] }),
    ])
  })

  it('blocks a candidate when an answer differs from the official key path', () => {
    const audit = auditCandidate({
      subjectCode: '02800',
      questions: questions.slice(0, 1),
      officialKeys: new Map([['01-1', [4]]]),
    })

    expect(audit.status).toBe('blocked')
    expect(audit.blockers).toContain('answer-key-integrity')
    expect(audit.answerIntegrity.mismatches).toEqual([
      { id: '02800-01-001', parsed: [2], official: [4] },
    ])
  })
})

describe('buildCandidateConfig', () => {
  it('creates a conservative class-C draft without publishing it', () => {
    const config = buildCandidateConfig({
      specifier: parseExamSpecifier('120003'),
      document: {
        title: '電腦硬體裝修',
        version: 'A12',
        pdfFilename: '120003A12.pdf',
        officialUrl: 'https://owinform.wdasec.gov.tw/owInform/DLowFile/120003A12.pdf',
      },
      category: '資訊類群',
      questionCount: 700,
      sha256: 'a'.repeat(64),
    })

    expect(config).toMatchObject({
      publishable: false,
      subjectCode: '12000',
      level: '丙級',
      titleZh: '電腦硬體裝修丙級',
      category: '資訊類群',
      occupationExpected: 700,
      version: 'A12',
      mockRules: { occupationQuota: 64, singleCount: 80, multipleCount: 0 },
    })
    expect(config.manualFields).toContain('examId')
    expect(config.manualFields).toContain('extraCommonCodes')
    expect(config.manualFields).toContain('mockRules')
  })
})
