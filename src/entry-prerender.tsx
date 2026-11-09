/* eslint-disable react-refresh/only-export-components -- build-only entry, never in the HMR graph; it exports render helpers and prerender constants, not live components. */
// Build-time only entry: scripts/prerender.mjs renders the landing pages into
// dist so crawlers get real HTML instead of an empty #root (the app is otherwise
// a fully client-rendered SPA). Never imported by the browser bundle — main.tsx's
// createRoot().render() replaces this markup on load.
import { renderToString } from 'react-dom/server'
import { INSTALLED_EXAMS } from './app/activeExam'
import { LandingPage } from './app/LandingPage'
import { ExamPage } from './app/ExamPage'
import { GuidePage } from './app/GuidePage'
import { CatalogPage } from './app/CatalogPage'
import { guideFaqs } from './app/guideFaqs'
import { enLanding } from './i18n/en'
import { CATALOG_PATH, SITE_ORIGIN, catalogTitle, examPageTitle, examPath } from './app/seoUrls'
import { examFaqJsonLd } from './app/examFaqs'

const noop = () => undefined

// AEO guide page at /guide.
export function renderGuidePage(): string {
  return renderToString(<GuidePage exams={INSTALLED_EXAMS} onEnter={noop} onHome={noop} />)
}

// FAQPage schema for the guide, built from the same strings it renders so the
// structured data matches the visible Q&As (and is quotable by answer engines).
export const GUIDE_FAQ_JSONLD: string = JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'zh-Hant-TW',
    mainEntity: guideFaqs(new Date()).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  },
  null,
  2,
)

// Per-exam SEO pages: one prerendered /exam/<id>/ each. Metadata is exposed so
// prerender.mjs can build a Chinese <head> per exam without re-parsing manifests.
export function renderExamPage(examId: string): string {
  const exam = INSTALLED_EXAMS.find((candidate) => candidate.examId === examId)
  if (!exam) throw new Error(`renderExamPage: unknown exam ${examId}`)
  return renderToString(<ExamPage exam={exam} onEnter={noop} onHome={noop} />)
}

export { SITE_ORIGIN, EN_PATH, EN_TITLE, GUIDE_PATH, CATALOG_PATH } from './app/seoUrls'

// Exam catalog at /exams/: every published exam, all cards visible (filters only
// apply after hydration), so it is the crawl hub linking each /exam/<id>/ page.
export function renderCatalogPage(): string {
  return renderToString(<CatalogPage exams={INSTALLED_EXAMS} onEnter={noop} onHome={noop} />)
}

export const CATALOG_TITLE = catalogTitle(INSTALLED_EXAMS.length)
export const CATALOG_DESC = `${INSTALLED_EXAMS.length} 個技術士技能檢定考科的官方公開學科題庫，依職類與級別分類，可用名稱或代碼搜尋。每一科都能免費線上練習、整理錯題、計時模擬考；免註冊，可離線。`

// ItemList of every exam page, in the order the catalog shows them.
export const CATALOG_ITEMLIST_JSONLD: string = JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '技能檢定學科題庫總覽',
    url: `${SITE_ORIGIN}${CATALOG_PATH}`,
    numberOfItems: INSTALLED_EXAMS.length,
    itemListElement: INSTALLED_EXAMS.map((exam, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${exam.titleZh}學科題庫`,
      url: `${SITE_ORIGIN}${examPath(exam.examId)}`,
    })),
  },
  null,
  2,
)

export const EXAM_META = INSTALLED_EXAMS.map((exam) => ({
  id: exam.examId,
  path: examPath(exam.examId),
  // Same builder as the visible FAQ on the page, so the markup can't drift.
  faqJsonLd: examFaqJsonLd(exam, new Date()),
  title: examPageTitle(exam.titleZh, exam.activeQuestionCount),
  titleZh: exam.titleZh,
  category: exam.category,
  level: exam.level,
  count: exam.activeQuestionCount,
  subjectCode: exam.sections[0]?.subjectCode ?? exam.examId,
}))

export function renderLanding(): string {
  return renderToString(
    <LandingPage exams={INSTALLED_EXAMS} onEnter={noop} returning={false} lang="zh" />,
  )
}

export function renderLandingEn(): string {
  return renderToString(
    <LandingPage exams={INSTALLED_EXAMS} onEnter={noop} returning={false} t={enLanding} lang="en" />,
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
