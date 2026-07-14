export interface NationalExamScheduleEntry {
  id: string
  year: 115
  round: 1 | 2 | 3
  label: string
  writtenDate: string
  registrationStart: string
  registrationEnd: string
}

export const NATIONAL_EXAM_SCHEDULE_SOURCE = 'https://skill.tcte.edu.tw/doc/YR115/115Skill_reg_20260401.pdf'

export const NATIONAL_EXAM_SCHEDULE_115: NationalExamScheduleEntry[] = [
  {
    id: '115-1',
    year: 115,
    round: 1,
    label: '115年度第1梯次',
    writtenDate: '2026-03-15',
    registrationStart: '2026-01-02',
    registrationEnd: '2026-01-13',
  },
  {
    id: '115-2',
    year: 115,
    round: 2,
    label: '115年度第2梯次',
    writtenDate: '2026-07-05',
    registrationStart: '2026-04-24',
    registrationEnd: '2026-05-05',
  },
  {
    id: '115-3',
    year: 115,
    round: 3,
    label: '115年度第3梯次',
    writtenDate: '2026-11-08',
    registrationStart: '2026-08-27',
    registrationEnd: '2026-09-07',
  },
]

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isScheduleEntryPast(entry: Pick<NationalExamScheduleEntry, 'writtenDate'>, now: Date) {
  const examDate = new Date(`${entry.writtenDate}T00:00:00`)
  if (Number.isNaN(examDate.getTime())) return false
  return startOfLocalDay(examDate).getTime() < startOfLocalDay(now).getTime()
}

export function getNextNationalExamEntry(now: Date, entries = NATIONAL_EXAM_SCHEDULE_115) {
  return entries.find((entry) => !isScheduleEntryPast(entry, now)) ?? null
}

/** Whole local days from `now` to an ISO date; negative once the date has passed. */
function daysBetween(now: Date, isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) return Number.NaN
  return Math.round((startOfLocalDay(target).getTime() - startOfLocalDay(now).getTime()) / 86_400_000)
}

/** How far ahead of the window opening we start warning. Registration itself only runs ~12 days. */
const UPCOMING_WINDOW_DAYS = 14
/** Below this many days left to register, the notice escalates. */
const URGENT_DAYS = 3

export type RegistrationPhase = 'open' | 'upcoming'

export interface RegistrationNotice {
  entry: NationalExamScheduleEntry
  phase: RegistrationPhase
  /** Days until the window closes (`open`) or opens (`upcoming`). 0 means today. */
  daysRemaining: number
  urgent: boolean
}

/**
 * The registration window worth telling the learner about right now, or null.
 *
 * Missing registration is the one deadline that cannot be recovered from — it
 * costs a whole round (months of study aimed at a date you then cannot sit),
 * unlike the exam date itself, which the learner cannot miss by accident. So
 * this surfaces only while it is actionable and returns null the rest of the
 * year rather than becoming permanent furniture.
 */
export function getRegistrationNotice(now: Date, entries = NATIONAL_EXAM_SCHEDULE_115): RegistrationNotice | null {
  // The first round whose window has not already closed; a past exam's window is
  // closed by definition, so this also skips fully-past rounds.
  const entry = entries.find((candidate) => daysBetween(now, candidate.registrationEnd) >= 0)
  if (!entry) return null

  const untilOpen = daysBetween(now, entry.registrationStart)
  if (untilOpen <= 0) {
    const daysRemaining = daysBetween(now, entry.registrationEnd)
    return { entry, phase: 'open', daysRemaining, urgent: daysRemaining <= URGENT_DAYS }
  }
  if (untilOpen <= UPCOMING_WINDOW_DAYS) {
    return { entry, phase: 'upcoming', daysRemaining: untilOpen, urgent: false }
  }
  return null
}
