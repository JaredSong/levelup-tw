// Pure exam-model layer. MUST stay free of DOM, Dexie, React, or browser storage
// imports so it can be shared by web and mobile. See docs/level-up-public-app-plan.md.

export type SourceGroup = 'occupation' | 'information-common' | 'general-common'

export interface ExamSection {
  /** Section id as it appears in question ids, e.g. "17300-01". */
  id: string
  subjectCode: string
  sourceGroup: SourceGroup
  titleZh: string
  /** Total questions parsed for this section, including inactive. */
  questionCount: number
  /** Questions available for practice (active !== false). */
  activeQuestionCount: number
}

export interface MockRules {
  totalQuestions: number
  singleCount: number
  multipleCount: number
  durationMinutes: number
  /** Weighted score needed to pass, out of maxScore. */
  passScore: number
  maxScore: number
  /** Weight applied per kind when scoring the weighted mock. */
  weightSingle: number
  weightMultiple: number
  /** How the 80 items are drawn across subjects. */
  subjectQuota: { subjectCode: string; count: number }[]
}

export interface ExamManifest {
  /** Stable global exam id used as the storage namespace, e.g. "web-design-b". */
  examId: string
  level: string
  titleZh: string
  titleEn: string
  category: string
  version: string
  sourceUrl?: string
  sourceRevision?: string
  sections: ExamSection[]
  mockRules: MockRules
  questionCount: number
  activeQuestionCount: number
}

/** Separator between examId and the local (official) question id in a questionKey. */
export const QUESTION_KEY_SEPARATOR = ':'

/**
 * Build the multi-exam-safe storage key for a question. The local `questionId`
 * (e.g. "17300-01-001") stays stable and human-meaningful; the key namespaces it
 * under its exam so progress/attempts/explanations never collide across exams.
 */
export function questionKey(examId: string, questionId: string): string {
  return `${examId}${QUESTION_KEY_SEPARATOR}${questionId}`
}

/**
 * Split a questionKey back into its parts. Only the first separator is treated as
 * the boundary, so local ids containing a colon survive the round trip.
 */
export function parseQuestionKey(key: string): { examId: string; questionId: string } {
  const at = key.indexOf(QUESTION_KEY_SEPARATOR)
  if (at === -1) throw new Error(`Not a namespaced question key: ${key}`)
  return { examId: key.slice(0, at), questionId: key.slice(at + QUESTION_KEY_SEPARATOR.length) }
}

/** True when a stored id is already namespaced (post-migration), vs a bare local id. */
export function isQuestionKey(value: string): boolean {
  return value.includes(QUESTION_KEY_SEPARATOR)
}
