import { useContext } from 'react'
import { ActiveExamContext } from './ActiveExamContext'

export function useActiveExam() {
  const value = useContext(ActiveExamContext)
  if (!value) throw new Error('useActiveExam must be used inside ActiveExamProvider')
  return value
}
