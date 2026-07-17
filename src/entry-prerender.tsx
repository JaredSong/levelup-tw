/* eslint-disable react-refresh/only-export-components -- build-only entry, never in the HMR graph; it exports render helpers and prerender constants, not live components. */
// Build-time only entry: scripts/prerender.mjs renders the landing pages into
// dist so crawlers get real HTML instead of an empty #root (the app is otherwise
// a fully client-rendered SPA). Never imported by the browser bundle — main.tsx's
// createRoot().render() replaces this markup on load.
import { renderToString } from 'react-dom/server'
import { INSTALLED_EXAMS } from './app/activeExam'
import { LandingPage } from './app/LandingPage'
import { ExamPage } from './app/ExamPage'
import { enLanding } from './i18n/en'

const noop = () => undefined

// Per-exam SEO pages: one prerendered /exam/<id>/ each. Metadata is exposed so
// prerender.mjs can build a Chinese <head> per exam without re-parsing manifests.
export function renderExamPage(examId: string): string {
  const exam = INSTALLED_EXAMS.find((candidate) => candidate.examId === examId)
  if (!exam) throw new Error(`renderExamPage: unknown exam ${examId}`)
  return renderToString(<ExamPage exam={exam} onEnter={noop} onHome={noop} />)
}

export const EXAM_META = INSTALLED_EXAMS.map((exam) => ({
  id: exam.examId,
  titleZh: exam.titleZh,
  category: exam.category,
  level: exam.level,
  count: exam.activeQuestionCount,
  subjectCode: exam.sections[0]?.subjectCode ?? exam.examId,
}))

export function renderLanding(): string {
  return renderToString(
    <LandingPage exams={INSTALLED_EXAMS} onEnter={noop} onSelectExam={noop} returning={false} lang="zh" />,
  )
}

export function renderLandingEn(): string {
  return renderToString(
    <LandingPage exams={INSTALLED_EXAMS} onEnter={noop} onSelectExam={noop} returning={false} t={enLanding} lang="en" />,
  )
}

// English FAQ structured data for /en, built from the same strings the page
// renders so the schema always matches the visible copy. prerender.mjs swaps
// this in for the Chinese FAQPage block. Indented to sit tidily in <head>.
export const EN_FAQ_JSONLD: string = JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'en',
    mainEntity: [
      [enLanding.faqOfficialQ, enLanding.faqOfficialA],
      [enLanding.faqFreeQ, enLanding.faqFreeA],
      [enLanding.faqAccountQ, enLanding.faqAccountA],
      [enLanding.faqSourceQ, enLanding.faqSourceA],
      [enLanding.faqProgressQ, enLanding.faqProgressA],
      [enLanding.faqExamsQ, enLanding.faqExamsA],
    ].map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  },
  null,
  2,
)

// English WebApplication description for /en, to replace the Chinese one.
export const EN_APP_DESCRIPTION =
  'Free, offline-first written-exam question bank for Taiwan\'s national skills certification (技術士技能檢定), combining official questions, automatic mistake fixing, long-term spaced review and timed mock exams.'
