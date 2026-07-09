import { useMemo, useState, type ReactNode } from 'react'
import {
  chooseActiveExamId,
  INSTALLED_EXAMS,
  readSavedActiveExamId,
  saveActiveExamId,
} from './activeExam'
import { ActiveExamContext, type ActiveExamContextValue } from './ActiveExamContext'

function initialExamId() {
  return chooseActiveExamId(INSTALLED_EXAMS, readSavedActiveExamId()) ?? INSTALLED_EXAMS[0].examId
}

export function ActiveExamProvider({ children }: { children: ReactNode }) {
  const [activeExamId, setActiveExamIdState] = useState(initialExamId)
  const value = useMemo<ActiveExamContextValue>(() => {
    const activeExam = INSTALLED_EXAMS.find((exam) => exam.examId === activeExamId) ?? INSTALLED_EXAMS[0]
    return {
      installedExams: INSTALLED_EXAMS,
      activeExam,
      setActiveExamId(examId: string) {
        if (!INSTALLED_EXAMS.some((exam) => exam.examId === examId)) return
        saveActiveExamId(examId)
        setActiveExamIdState(examId)
      },
    }
  }, [activeExamId])

  return <ActiveExamContext.Provider value={value}>{children}</ActiveExamContext.Provider>
}
