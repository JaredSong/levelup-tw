import { useEffect, useState } from 'react'
import type { BankState } from '../types'
import type { Question } from '../domain/studyEngine'

export function useQuestionBank() {
  const [bank, setBank] = useState<BankState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/questions.json')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the question bank.')
        return response.json() as Promise<Question[]>
      })
      .then((questions) =>
        setBank({ questions, byId: new Map(questions.map((q) => [q.id, q])) }),
      )
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Question bank failed.'),
      )
  }, [])

  return { bank, error }
}
