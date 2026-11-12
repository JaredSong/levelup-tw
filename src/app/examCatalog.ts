// Shared catalog logic for the landing page and the /exams/ catalog: category
// labels and anchors, official 報檢人次 per exam, and the search/level filter.
// Everything derives from the manifests plus the generated landing catalog, so a
// new pack shows up here without a copy edit.
import type { ExamManifest } from '../core/exam'
import { GENERATED_LANDING_CATALOG } from './generatedLandingCatalog'

/** English labels for the manifests' Chinese categories (also the slug source). */
export const EN_CATEGORY: Record<string, string> = {
  商業服務: 'Business Services',
  餐飲食品: 'Food & Beverage',
  美容美髮: 'Beauty & Hair',
  車輛修護: 'Vehicle Repair',
  航空修護: 'Aircraft Maintenance',
  照護服務: 'Care Services',
  生活服務: 'Personal Services',
  資訊: 'Information',
  機械操作: 'Machinery Operation',
  電機工程: 'Electrical Engineering',
  電子儀表: 'Electronics & Instrumentation',
  營造工程: 'Construction',
  職業安全衛生: 'Occupational Safety & Health',
  銲接配管: 'Welding & Piping',
  金屬及機械加工: 'Metal & Machinery Processing',
  農業園藝: 'Agriculture & Horticulture',
  化學工業: 'Chemical Industry',
}

export const EN_LEVEL: Record<string, string> = {
  丙級: 'Class C',
  乙級: 'Class B',
  甲級: 'Class A',
  單一級: 'Single Level',
}

/** Display order for level filters: entry level first. */
const LEVEL_ORDER = ['丙級', '乙級', '甲級', '單一級']

/**
 * Stable ASCII anchor for a category (`/exams/#cat-food-beverage`). Falls back to
 * the category's position so an unmapped new category still gets a unique id.
 */
export function categorySlug(category: string, fallbackIndex = 0): string {
  const en = EN_CATEGORY[category]
  if (!en) return `cat-${fallbackIndex + 1}`
  return `cat-${en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export interface CategoryGroup {
  category: string
  slug: string
  exams: ExamManifest[]
  questionCount: number
}

/** Groups in manifest order (the same order the app's picker uses). */
export function groupByCategory(exams: ExamManifest[]): CategoryGroup[] {
  const groups: CategoryGroup[] = []
  for (const exam of exams) {
    let group = groups.find((g) => g.category === exam.category)
    if (!group) {
      group = { category: exam.category, slug: categorySlug(exam.category, groups.length), exams: [], questionCount: 0 }
      groups.push(group)
    }
    group.exams.push(exam)
    group.questionCount += exam.activeQuestionCount
  }
  return groups
}

export function levelsOf(exams: ExamManifest[]): string[] {
  const present = new Set(exams.map((exam) => exam.level))
  return [...LEVEL_ORDER.filter((level) => present.has(level)), ...[...present].filter((level) => !LEVEL_ORDER.includes(level))]
}

/** The occupation subject code, e.g. 15100 — what people type when they search. */
export function examCode(exam: ExamManifest): string {
  return exam.sections.find((section) => section.sourceGroup === 'occupation')?.subjectCode
    ?? exam.sections[0]?.subjectCode
    ?? exam.examId
}

export interface CatalogFilter {
  query: string
  /** A manifest level such as 丙級, or '' for all levels. */
  level: string
  /** A manifest category, or '' for all categories. */
  category: string
}

export function matchesFilter(exam: ExamManifest, filter: CatalogFilter): boolean {
  if (filter.level && exam.level !== filter.level) return false
  if (filter.category && exam.category !== filter.category) return false
  const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = [
    exam.titleZh,
    exam.titleEn,
    exam.category,
    exam.level,
    EN_CATEGORY[exam.category] ?? '',
    ...exam.sections.map((section) => section.subjectCode),
  ].join(' ').toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

// --- Official demand (報檢人次) ---------------------------------------------

/**
 * "115年截至9月底止…" → { year: 115, month: 9 }. The scraped period string carries
 * trailing words; only the year and month are trusted. If it stops parsing, the
 * counts are not shown at all rather than shown without their period.
 */
export function parseDemandPeriod(period: string): { year: number; month: number } | null {
  const match = period.match(/^(\d{2,3})年截至(\d{1,2})月底/)
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

export const DEMAND_PERIOD = parseDemandPeriod(GENERATED_LANDING_CATALOG.demandPeriod)
export const DEMAND_SOURCE: string = GENERATED_LANDING_CATALOG.demandSource

const APPLICANTS = new Map<string, number>(
  GENERATED_LANDING_CATALOG.exams
    .filter((entry) => typeof entry.applicantCount === 'number' && entry.applicantCount > 0)
    .map((entry) => [entry.examId, entry.applicantCount as number]),
)

/** Official 報檢人次 for this exam's code and level, or null when unknown. */
export function applicantCount(examId: string): number | null {
  if (!DEMAND_PERIOD) return null
  return APPLICANTS.get(examId) ?? null
}

/** Exams ranked by official 報檢人次 (unknown last), keeping only installed ones. */
export function rankByDemand(exams: ExamManifest[]): ExamManifest[] {
  const order = new Map<string, number>(GENERATED_LANDING_CATALOG.exams.map((entry, index) => [entry.examId, index]))
  const rank = (exam: ExamManifest) => order.get(exam.examId) ?? Number.MAX_SAFE_INTEGER
  return [...exams].sort((a, b) => rank(a) - rank(b))
}
