import { createContext } from 'react'
import type { ExamManifest } from '../core/exam'

export interface ActiveExamContextValue {
  installedExams: ExamManifest[]
  activeExam: ExamManifest
  setActiveExamId: (examId: string) => void
}

export const ActiveExamContext = createContext<ActiveExamContextValue | null>(null)
