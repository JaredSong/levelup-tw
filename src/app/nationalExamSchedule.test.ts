import { describe, expect, it } from 'vitest'
import {
  getNextNationalExamEntry,
  getRegistrationNotice,
  isScheduleEntryPast,
  NATIONAL_EXAM_SCHEDULE_115,
} from './nationalExamSchedule'

// 115-3: written 2026-11-08, registration 2026-08-27 → 2026-09-07.
const ROUND_3 = NATIONAL_EXAM_SCHEDULE_115[2]

describe('getNextNationalExamEntry', () => {
  it('returns the next round that has not been sat yet', () => {
    expect(getNextNationalExamEntry(new Date('2026-07-15T12:00:00'))?.id).toBe('115-3')
    expect(getNextNationalExamEntry(new Date('2026-03-14T12:00:00'))?.id).toBe('115-1')
  })

  it('counts the exam day itself as still upcoming', () => {
    expect(isScheduleEntryPast(ROUND_3, new Date('2026-11-08T23:00:00'))).toBe(false)
    expect(isScheduleEntryPast(ROUND_3, new Date('2026-11-09T00:01:00'))).toBe(true)
  })

  it('returns null once every bundled round has passed', () => {
    expect(getNextNationalExamEntry(new Date('2026-11-09T12:00:00'))).toBeNull()
  })
})

describe('getRegistrationNotice', () => {
  it('stays silent when the window is far off, rather than becoming permanent furniture', () => {
    // 2026-07-15 → round 3 registration opens 8/27, still 43 days out.
    expect(getRegistrationNotice(new Date('2026-07-15T12:00:00'))).toBeNull()
  })

  it('warns once the window is within two weeks of opening', () => {
    const notice = getRegistrationNotice(new Date('2026-08-14T09:00:00'))
    expect(notice).toMatchObject({ phase: 'upcoming', daysRemaining: 13, urgent: false })
    expect(notice?.entry.id).toBe('115-3')
  })

  it('does not warn one day before the two-week window opens', () => {
    expect(getRegistrationNotice(new Date('2026-08-12T09:00:00'))).toBeNull()
  })

  it('switches to open on the first day of registration', () => {
    const notice = getRegistrationNotice(new Date('2026-08-27T08:00:00'))
    expect(notice).toMatchObject({ phase: 'open', daysRemaining: 11, urgent: false })
  })

  it('counts down the days left to register', () => {
    expect(getRegistrationNotice(new Date('2026-09-01T12:00:00'))).toMatchObject({ phase: 'open', daysRemaining: 6 })
  })

  it('escalates to urgent in the last three days', () => {
    expect(getRegistrationNotice(new Date('2026-09-04T12:00:00'))).toMatchObject({ daysRemaining: 3, urgent: true })
    expect(getRegistrationNotice(new Date('2026-09-05T12:00:00'))).toMatchObject({ daysRemaining: 2, urgent: true })
  })

  it('still shows on the closing day itself, not a day early', () => {
    expect(getRegistrationNotice(new Date('2026-09-07T23:30:00'))).toMatchObject({
      entry: { id: '115-3' },
      phase: 'open',
      daysRemaining: 0,
      urgent: true,
    })
  })

  it('moves on to the next round once a window closes', () => {
    // 115-1 registration closed 1/13; the next open-able window is 115-2 (opens 4/24).
    const notice = getRegistrationNotice(new Date('2026-01-14T09:00:00'))
    expect(notice).toBeNull() // 115-2 is still ~3 months out
    expect(getRegistrationNotice(new Date('2026-04-24T09:00:00'))?.entry.id).toBe('115-2')
  })

  it('returns null when every bundled window has closed', () => {
    expect(getRegistrationNotice(new Date('2026-09-08T09:00:00'))).toBeNull()
  })

  it('never reports a window for a round whose exam has already been sat', () => {
    for (const now of ['2026-03-16T09:00:00', '2026-07-06T09:00:00', '2026-11-09T09:00:00']) {
      const notice = getRegistrationNotice(new Date(now))
      if (notice) expect(isScheduleEntryPast(notice.entry, new Date(now))).toBe(false)
    }
  })
})
