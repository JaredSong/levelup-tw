import { useEffect, useState } from 'react'
import { QUESTION_KEY_SEPARATOR } from '../core/exam'
import { localDayKey, type TodayAttempt } from '../domain/dailyMission'
import { db } from '../storage/db'

export interface TodayActivity {
  /** Today's attempts for this exam, with bare question ids. */
  todayAttempts: TodayAttempt[]
  /** Review-card grades logged today. */
  reviewsDoneToday: number
  /** Every attempt/review timestamp, for the study streak. */
  activityTimestamps: string[]
}

const EMPTY: TodayActivity = { todayAttempts: [], reviewsDoneToday: 0, activityTimestamps: [] }

/**
 * Today's study activity, derived from attempts and review logs. `progress` and
 * `reviewCards` are re-query triggers: they change after every answer/grade, so
 * the mission counters stay live without a dedicated event channel.
 */
export function useTodayActivity(examId: string, progress: unknown, reviewCards: unknown): TodayActivity {
  const [activity, setActivity] = useState<TodayActivity>(EMPTY)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const prefix = `${examId}${QUESTION_KEY_SEPARATOR}`
      const [attempts, logs] = await Promise.all([
        db.attempts.where('questionId').startsWith(prefix).toArray(),
        db.reviewLogs.where('examId').equals(examId).toArray(),
      ])
      const today = localDayKey(new Date())
      const todayAttempts = attempts
        .filter((attempt) => localDayKey(attempt.answeredAt) === today)
        .map((attempt) => ({ questionId: attempt.questionId.slice(prefix.length), correct: attempt.correct, answeredAt: attempt.answeredAt }))
      const reviewsDoneToday = logs.filter((log) => localDayKey(log.reviewedAt) === today).length
      const activityTimestamps = [
        ...attempts.map((attempt) => attempt.answeredAt),
        ...logs.map((log) => log.reviewedAt),
      ]
      if (!cancelled) setActivity({ todayAttempts, reviewsDoneToday, activityTimestamps })
    })()
    return () => { cancelled = true }
  }, [examId, progress, reviewCards])

  return activity
}
