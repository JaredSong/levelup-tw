import { ArrowRight, Clock, Database, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ExamManifest } from '../core/exam'
import { trackLanding } from './analytics'
import { categoryIcon } from './categoryIcons'
import { EN_CATEGORY, EN_LEVEL, applicantCount, examCode } from './examCatalog'
import { examPath } from './seoUrls'

export interface ExamCardStrings {
  examCount: (count: number) => string
  mockSpec: (questions: number, minutes: number) => string
  applicants: (count: number) => string
  cardAction: string
}

interface Props {
  exam: ExamManifest
  t: ExamCardStrings
  lang?: 'zh' | 'en'
  /** Analytics label for where the card sits (popular, catalog…). */
  location: string
  index?: number
  /** Heading level: h3 inside a titled section, h2 when the card list is the page. */
  headingLevel?: 'h2' | 'h3'
  /** A visual copy for a looping row: hidden from assistive tech and the tab order. */
  cloned?: boolean
}

// One exam as a card linking to its public /exam/<id>/ page. Every figure comes
// from the manifest (question count, mock rules) or the official 報檢人次
// statistics — nothing typed by hand, so a card can't drift from its pack.
export function ExamCard({ exam, t, lang = 'zh', location, index = 0, headingLevel: Heading = 'h3', cloned = false }: Props) {
  const Icon = categoryIcon(exam.category)
  const title = lang === 'en' ? exam.titleEn : exam.titleZh
  const category = lang === 'en' ? EN_CATEGORY[exam.category] ?? exam.category : exam.category
  const level = lang === 'en' ? EN_LEVEL[exam.level] ?? exam.level : exam.level
  const applicants = applicantCount(exam.examId)
  return (
    <a
      className="exam-card"
      href={examPath(exam.examId)}
      onClick={() => trackLanding('exam_details', { exam_id: exam.examId, cta_location: location })}
      style={{ '--card-index': index } as CSSProperties}
      aria-hidden={cloned || undefined}
      tabIndex={cloned ? -1 : undefined}
      data-clone={cloned || undefined}
    >
      <span className="exam-card-top">
        <span className="exam-card-icon" aria-hidden="true"><Icon size={18} /></span>
        <span className="exam-card-level">{level}</span>
      </span>
      <Heading className="exam-card-title">{title}</Heading>
      <span className="exam-card-meta">{examCode(exam)} · {category}</span>
      <span className="exam-card-facts">
        <span><Database size={14} aria-hidden="true" />{t.examCount(exam.activeQuestionCount)}</span>
        <span><Clock size={14} aria-hidden="true" />{t.mockSpec(exam.mockRules.totalQuestions, exam.mockRules.durationMinutes)}</span>
        {applicants ? <span><Users size={14} aria-hidden="true" />{t.applicants(applicants)}</span> : null}
      </span>
      <span className="exam-card-action">{t.cardAction}<ArrowRight size={15} aria-hidden="true" /></span>
    </a>
  )
}
