import { describe, it, expect } from 'vitest'
import { questionKey, parseQuestionKey, isQuestionKey, mockDurationMilliseconds } from './exam'

describe('questionKey', () => {
  it('namespaces a local id under its exam', () => {
    expect(questionKey('web-design-b', '17300-01-001')).toBe('web-design-b:17300-01-001')
  })

  it('round-trips through parseQuestionKey', () => {
    const key = questionKey('web-design-b', '17300-02-247')
    expect(parseQuestionKey(key)).toEqual({ examId: 'web-design-b', questionId: '17300-02-247' })
  })

  it('keeps the local id intact even if it contains a separator', () => {
    const key = questionKey('web-design-b', 'weird:id')
    expect(parseQuestionKey(key)).toEqual({ examId: 'web-design-b', questionId: 'weird:id' })
  })

  it('rejects a bare local id', () => {
    expect(() => parseQuestionKey('17300-01-001')).toThrow()
  })

  it('distinguishes namespaced keys from bare local ids', () => {
    expect(isQuestionKey('web-design-b:17300-01-001')).toBe(true)
    expect(isQuestionKey('17300-01-001')).toBe(false)
  })
})

describe('mockDurationMilliseconds', () => {
  it('uses the duration declared by the active exam rather than a global constant', () => {
    expect(mockDurationMilliseconds({ durationMinutes: 75 })).toBe(75 * 60_000)
  })

  it('rejects a missing or invalid timer duration before a mock can start at zero', () => {
    expect(() => mockDurationMilliseconds({ durationMinutes: 0 })).toThrow('Invalid mock duration')
    expect(() => mockDurationMilliseconds({ durationMinutes: Number.NaN })).toThrow('Invalid mock duration')
  })
})
