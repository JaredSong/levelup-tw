import { useMemo, useState, type ReactNode } from 'react'
import {
  chooseActiveExamId,
  chooseSelectedExamIds,
  INSTALLED_EXAMS,
  readSavedActiveExamId,
  readSelectedExamIds,
  saveActiveExamId,
  saveSelectedExamIds,
} from './activeExam'
import { ActiveExamContext, type ActiveExamContextValue } from './ActiveExamContext'

function initialState() {
  const activeExamId = chooseActiveExamId(INSTALLED_EXAMS, readSavedActiveExamId()) ?? INSTALLED_EXAMS[0].examId
  return {
    activeExamId,
    selectedExamIds: chooseSelectedExamIds(INSTALLED_EXAMS, readSelectedExamIds(), activeExamId),
  }
}

export function ActiveExamProvider({ children }: { children: ReactNode }) {
  const [{ activeExamId, selectedExamIds }, setExamState] = useState(initialState)
  const value = useMemo<ActiveExamContextValue>(() => {
    const activeExam = INSTALLED_EXAMS.find((exam) => exam.examId === activeExamId) ?? INSTALLED_EXAMS[0]
    const selectedSet = new Set(selectedExamIds)
    const selectedExams = selectedExamIds
      .map((examId) => INSTALLED_EXAMS.find((exam) => exam.examId === examId))
      .filter((exam): exam is typeof INSTALLED_EXAMS[number] => Boolean(exam))
    return {
      installedExams: INSTALLED_EXAMS,
      selectedExams: selectedExams.length ? selectedExams : [activeExam],
      activeExam,
      setActiveExamId(examId: string) {
        if (!INSTALLED_EXAMS.some((exam) => exam.examId === examId)) return
        const nextSelectedExamIds = selectedSet.has(examId) ? selectedExamIds : [...selectedExamIds, examId]
        saveActiveExamId(examId)
        saveSelectedExamIds(nextSelectedExamIds)
        setExamState({ activeExamId: examId, selectedExamIds: nextSelectedExamIds })
      },
    }
  }, [activeExamId, selectedExamIds])

  return <ActiveExamContext.Provider value={value}>{children}</ActiveExamContext.Provider>
}
