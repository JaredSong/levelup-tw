import { describe, expect, it } from 'vitest'
import { daysUntilExam, EXAM_DATE_KEY, getEffectiveExamDate, getExamDate, setExamDate } from './examCountdown'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

describe('getExamDate / setExamDate', () => {
  it('reads and writes the stored date', () => {
    const storage = fakeStorage()
    setExamDate('2026-11-08', storage)
    expect(storage.getItem(EXAM_DATE_KEY)).toBe('2026-11-08')
    expect(getExamDate(storage)).toBe('2026-11-08')
  })

  it('trims whitespace before storing', () => {
    const storage = fakeStorage()
    setExamDate('  2026-11-08  ', storage)
    expect(getExamDate(storage)).toBe('2026-11-08')
  })

  it('clears the setting when given an empty value', () => {
    const storage = fakeStorage({ [EXAM_DATE_KEY]: '2026-11-08' })
    setExamDate('', storage)
    expect(getExamDate(storage)).toBeNull()
  })

  it('clears the setting when given only whitespace', () => {
    const storage = fakeStorage({ [EXAM_DATE_KEY]: '2026-11-08' })
    setExamDate('   ', storage)
    expect(getExamDate(storage)).toBeNull()
  })

  it('returns null when nothing is set', () => {
    expect(getExamDate(fakeStorage())).toBeNull()
  })
})

describe('daysUntilExam', () => {
  const now = new Date('2026-07-11T09:00:00')

  it('returns null when no date is set', () => {
    expect(daysUntilExam(null, now)).toBeNull()
  })

  it('returns null for an unparsable date', () => {
    expect(daysUntilExam('not-a-date', now)).toBeNull()
  })

  it('counts whole calendar days to a future date', () => {
    expect(daysUntilExam('2026-07-12', now)).toBe(1)
    expect(daysUntilExam('2026-08-10', now)).toBe(30)
  })

  it('returns 0 on the exam day itself, regardless of time of day', () => {
    expect(daysUntilExam('2026-07-11', now)).toBe(0)
    expect(daysUntilExam('2026-07-11', new Date('2026-07-11T23:59:00'))).toBe(0)
  })

  it('returns null once the date has passed, instead of a negative number', () => {
    expect(daysUntilExam('2026-07-10', now)).toBeNull()
    expect(daysUntilExam('2026-01-01', now)).toBeNull()
  })
})

describe('getEffectiveExamDate', () => {
  it('uses the manually stored date first', () => {
    const storage = fakeStorage({ [EXAM_DATE_KEY]: '2026-08-01' })
    expect(getEffectiveExamDate(new Date('2026-07-14T12:00:00'), storage)).toBe('2026-08-01')
  })

  it('falls back to the next official national skills test round', () => {
    expect(getEffectiveExamDate(new Date('2026-07-14T12:00:00'), fakeStorage())).toBe('2026-11-08')
  })

  it('returns null when all bundled official rounds have passed and no manual date is set', () => {
    expect(getEffectiveExamDate(new Date('2026-11-09T12:00:00'), fakeStorage())).toBeNull()
  })
})
