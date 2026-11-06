import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { getNextNationalExamEntry } from './nationalExamSchedule'
import { formatQuestionCount } from './seoUrls'

export interface ExamFaq {
  q: string
  a: string
}

/**
 * The FAQ an exam page shows and marks up as FAQPage JSON-LD. One builder for
 * both, so the structured data always matches the visible Q&As. Every fact is
 * read from the pack manifest or the schedule module — nothing is typed per
 * exam, so a regenerated pack or a passed deadline can't leave a stale answer.
 */
export function examFaqs(exam: ExamManifest, now: Date): ExamFaq[] {
  const t = zhTW.examPage
  const title = exam.titleZh
  const rules = exam.mockRules
  const occupationCode = exam.sections.find((section) => section.sourceGroup === 'occupation')?.subjectCode

  const faqs: ExamFaq[] = [
    t.faqCount(title, formatQuestionCount(exam.activeQuestionCount)),
    t.faqFormat(title, rules.totalQuestions, rules.singleCount, rules.multipleCount, rules.weightSingle, rules.weightMultiple, rules.passScore, rules.maxScore),
  ]

  const commonSubjects = [...new Map(
    exam.sections
      .filter((section) => section.sourceGroup !== 'occupation' && section.subjectCode !== occupationCode)
      .map((section) => [section.subjectCode, section.titleZh]),
  ).values()]
  if (commonSubjects.length) faqs.push(t.faqCommon(title, commonSubjects.join('、')))

  const pdfs = (exam.sources ?? []).map((source) => source.pdfFilename)
  if (pdfs.length) faqs.push(t.faqDownload(title, pdfs.join('、')))

  const next = getNextNationalExamEntry(now)
  if (next) faqs.push(t.faqSchedule(title, next.label, next.registrationStart, next.registrationEnd, next.writtenDate))

  return faqs
}

export function examFaqJsonLd(exam: ExamManifest, now: Date): string {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: 'zh-Hant-TW',
      mainEntity: examFaqs(exam, now).map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    null,
    2,
  )
}
