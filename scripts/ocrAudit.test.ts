import { describe, expect, it } from 'vitest'
import { compareQuestionToOcr, normalizeAuditText } from './ocrAudit.mjs'

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
