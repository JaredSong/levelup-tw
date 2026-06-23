import { useCallback, useEffect, useState } from 'react'
import type { Progress } from '../domain/studyEngine'
import { db } from '../storage/db'

export function useStudyData() {
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const rows = await db.progress.toArray()
    setProgress(Object.fromEntries(rows.map((row) => [row.questionId, row])))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { progress, setProgress, loading, refresh }
}
