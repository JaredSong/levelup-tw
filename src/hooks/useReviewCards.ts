import { useCallback, useEffect, useState } from 'react'
import type { ReviewCard } from '../core/contracts'
import { db } from '../storage/db'

export function useReviewCards(examId: string) {
  const [cards, setCards] = useState<ReviewCard[]>([])

  const refresh = useCallback(async () => {
    setCards(await db.reviewCards.where('examId').equals(examId).toArray())
  }, [examId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { cards, refresh }
}
