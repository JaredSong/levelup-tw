// User-set target exam date for the Home countdown. This is a per-user setting,
// not exam content: two learners studying the same manifest sit the written
// test on different dates, so it does not belong in ExamManifest.
import { getNextNationalExamEntry } from './nationalExamSchedule'

export const EXAM_DATE_KEY = 'level-up-target-exam-date'

export function getExamDate(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  return storage.getItem(EXAM_DATE_KEY)
}

export function getEffectiveExamDate(now: Date, storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  return getExamDate(storage) ?? getNextNationalExamEntry(now)?.writtenDate ?? null
}

/** Empty/whitespace-only input clears the setting. */
export function setExamDate(value: string, storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage) {
  const trimmed = value.trim()
  if (trimmed) storage.setItem(EXAM_DATE_KEY, trimmed)
  else storage.removeItem(EXAM_DATE_KEY)
}

/**
 * Calendar-day countdown to a "YYYY-MM-DD" date. Returns null when no date is
 * set, the stored value doesn't parse, or the date has already passed —
 * Home hides the countdown entirely rather than showing a stale/negative
 * number, and the same empty state invites setting a new date.
 */
export function daysUntilExam(examDateIso: string | null, now: Date): number | null {
  if (!examDateIso) return null
  const exam = new Date(`${examDateIso}T00:00:00`)
  if (Number.isNaN(exam.getTime())) return null
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfExam = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate())
  const days = Math.round((startOfExam.getTime() - startOfToday.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}
