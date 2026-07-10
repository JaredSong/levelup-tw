import { useCallback, useEffect, useState } from 'react'
import { parseQuestionKey, QUESTION_KEY_SEPARATOR } from '../core/exam'
import type { Progress } from '../domain/studyEngine'
import { db } from '../storage/db'

export function useStudyData(examId: string) {
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Records store namespaced keys ("web-design-b:17300-01-001"); the in-memory
    // map is keyed by the bare question id so `progress[question.id]` lookups
    // stay the runtime convention.
    const rows = await db.progress.where('questionId').startsWith(`${examId}${QUESTION_KEY_SEPARATOR}`).toArray()
    setProgress(Object.fromEntries(rows.map((row) => [parseQuestionKey(row.questionId).questionId, row])))
    setLoading(false)
  }, [examId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { progress, setProgress, loading, refresh }
}
