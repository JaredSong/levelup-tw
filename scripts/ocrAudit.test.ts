import { describe, expect, it } from 'vitest'
import { buildOcrReviewQueue, compareQuestionToOcr, normalizeAuditText } from './ocrAudit.mjs'

describe('normalizeAuditText', () => {
  it('normalizes spacing without deleting meaningful code symbols', () => {
    expect(normalizeAuditText('$_SESSIO N  與  X = X + 1')).toBe('$_SESSION 與 X=X+1')
  })
})

describe('compareQuestionToOcr', () => {
  it('does not flag matching question text after harmless whitespace differences', () => {
    const result = compareQuestionToOcr(
      { id: 'q1', prompt: 'PHP 程式 $x+$y 輸出為何？', options: ['Hello World', '0'] },
      { id: 'q1', text: 'PHP 程式 $x + $y 輸出為何？ ①Hello World ②0' },
    )

    expect(result.flagged).toBe(false)
  })

  it('flags likely OCR/source disagreements for human review', () => {
    const result = compareQuestionToOcr(
      { id: 'q1', prompt: 'PHP 程式 $x+$y 輸出為何？', options: ['Hello World', '0'] },
      { id: 'q1', text: 'PHP 程式 $x.$y 輸出為何？ ①Hello World ②0' },
    )

    expect(result.flagged).toBe(true)
    expect(result.reason).toContain('diff')
  })
})

describe('buildOcrReviewQueue', () => {
  it('escalates only risky pages to PaddleOCR and preserves the reason', () => {
    const queue = buildOcrReviewQueue([
      { id: 'q-clean', sourcePage: 1, hasFigure: false, prompt: '何者正確？', options: ['甲', '乙', '丙', '丁'] },
      { id: 'q-figure', sourcePage: 2, hasFigure: true, prompt: '如下圖', options: ['甲', '乙', '丙', '丁'] },
      { id: 'q-options', sourcePage: 3, hasFigure: false, prompt: '何者正確？', options: ['甲', '乙'] },
      { id: 'q-spacing', sourcePage: 4, hasFigure: false, prompt: '$_SESSIO N 是什麼？', options: ['甲', '乙', '丙', '丁'] },
    ])

    expect(queue).toEqual([
      expect.objectContaining({ page: 2, questionIds: ['q-figure'], reasons: ['figure'] }),
      expect.objectContaining({ page: 3, questionIds: ['q-options'], reasons: ['option-count:2'] }),
      expect.objectContaining({ page: 4, questionIds: ['q-spacing'], reasons: ['suspicious-spacing'] }),
    ])
    expect(queue.every((item) => item.engine === 'paddle-pp-structure-v3')).toBe(true)
  })

  it('groups multiple risky questions from the same page into one OCR job', () => {
    const queue = buildOcrReviewQueue([
      { id: 'q1', sourcePage: 7, hasFigure: true, prompt: '圖一', options: ['1', '2', '3', '4'] },
      { id: 'q2', sourcePage: 7, hasFigure: false, prompt: '何者正確？', options: ['1', '2', '3'] },
    ])

    expect(queue).toEqual([
      expect.objectContaining({ page: 7, questionIds: ['q1', 'q2'], reasons: ['figure', 'option-count:3'] }),
    ])
  })
})
