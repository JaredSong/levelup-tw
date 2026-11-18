import { describe, expect, it } from 'vitest'
import { INSTALLED_EXAMS } from './activeExam'
import { NATIONAL_EXAM_ROUNDS_116 } from './nationalExamRounds'
import {
  getExamScheduleEntries,
  getNextExamRound,
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

  it('rolls over into the next year once the last round of a year has passed', () => {
    expect(getNextNationalExamEntry(new Date('2026-11-09T12:00:00'))?.id).toBe('116-1')
  })

  it('returns null once every bundled round has passed', () => {
    expect(getNextNationalExamEntry(new Date('2027-11-08T12:00:00'))).toBeNull()
  })
})

describe('per-exam rounds (116 梯次公告, 115.11.13 修正)', () => {
  it('has rounds read from the gazette for every published exam', () => {
    const missing = INSTALLED_EXAMS.map((exam) => exam.examId).filter((id) => !(id in NATIONAL_EXAM_ROUNDS_116))
    expect(missing).toEqual([])
  })

  it('only lists exams that are published', () => {
    const published = new Set(INSTALLED_EXAMS.map((exam) => exam.examId))
    expect(Object.keys(NATIONAL_EXAM_ROUNDS_116).filter((id) => !published.has(id))).toEqual([])
  })

  it('gives an exam the next round it actually runs in, not the next round overall', () => {
    // From 2026-11-18 the next round overall is 116-1 (written 2027-03-14).
    const now = new Date('2026-11-18T12:00:00')
    expect(getNextExamRound('computer-hardware-repair-c', now)?.id).toBe('116-1')
    expect(getNextExamRound('web-design-b', now)?.id).toBe('116-2')
    expect(getNextExamRound('machining-c', now)?.id).toBe('116-3')
    expect(getNextExamRound('childcare-single', new Date('2027-04-01T12:00:00'))?.id).toBe('116-3')
  })

  it('shows no round for an exam that is not in the 116 national exam', () => {
    const now = new Date('2026-11-18T12:00:00')
    expect(getNextExamRound('industrial-electronics-c', now)).toBeNull()
    expect(getNextExamRound('industrial-wiring-c', now)).toBeNull()
  })

  it('never borrows a year whose per-exam table has not been read', () => {
    expect(getExamScheduleEntries('beauty-c').map((entry) => entry.id)).toEqual(['116-1', '116-2', '116-3'])
  })

  it('keeps the registration nudge to the exam\'s own rounds', () => {
    // 116-1 registration is open on 2027-01-05; 測量丙 only runs in round 3.
    const now = new Date('2027-01-05T12:00:00')
    expect(getRegistrationNotice(now, getExamScheduleEntries('computer-hardware-repair-c'))?.entry.id).toBe('116-1')
    expect(getRegistrationNotice(now, getExamScheduleEntries('surveying-c'))).toBeNull()
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
