import { zhTW } from '../i18n/zh-TW'
import { getNextNationalExamEntry } from './nationalExamSchedule'

export interface GuideFaq {
  q: string
  a: string
}

/**
 * The guide's FAQ list, led by the upcoming round's registration and exam dates
 * when there is one. Shared by the rendered page and the FAQPage JSON-LD so the
 * two cannot drift — and computed from the schedule module rather than written
 * out, so a passed deadline can never sit on the page as stale prose.
 */
export function guideFaqs(now: Date): GuideFaq[] {
  const next = getNextNationalExamEntry(now)
  const base: GuideFaq[] = zhTW.guide.faqs.map((item) => ({ q: item.q, a: item.a }))
  if (!next) return base
  return [
    zhTW.guide.scheduleFaq(next.label, next.registrationStart, next.registrationEnd, next.writtenDate),
    ...base,
  ]
}
