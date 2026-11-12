/**
 * Short names learners type into search instead of the official exam title
 * (「軟丙」 for 電腦軟體應用丙級). Each entry comes from a real Search Console
 * query (export 2026-11-12, 3 months) with at least 10 impressions; a name that
 * could mean more than one exam (「電乙」) or is only a misspelling is left out.
 *
 * A name listed under several exams is a family name — 「中餐丙級」 covers both
 * 葷食 and 素食, which are separate written banks — and the page says so instead
 * of claiming it as this exam's alias.
 */
export const EXAM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'indoor-wiring-b': ['室內配線乙級', '室配乙級'],
  'indoor-wiring-c': ['室內配線丙級'],
  'chinese-cooking-meat-c': ['中餐丙級'],
  'chinese-cooking-vegetarian-c': ['中餐丙級'],
  'baking-food-c': ['烘焙丙級'],
  'digital-electronics-b': ['數位乙級'],
  'beverage-preparation-c': ['飲調丙級'],
  'western-cooking-c': ['西餐丙級'],
  'car-repair-c': ['汽車丙級'],
  'computer-software-application-c': ['軟丙', '丙軟', '電軟丙級'],
  'computer-software-application-b': ['軟乙'],
  'retail-service-c': ['門市丙級'],
  'dining-service-c': ['餐服丙級'],
  'accounting-c': ['會計丙級'],
  'water-pipe-fitting-c': ['自來水丙級'],
  'motorcycle-repair-c': ['機車丙級'],
  'care-service-single': ['照服員'],
  'computer-hardware-repair-b': ['硬裝乙級'],
  'aircraft-maintenance-c': ['飛丙'],
}

export interface ExamAlias {
  name: string
  /** Other exams the same name also covers; empty for a plain alias. */
  siblings: string[]
}

export function examAliases(examId: string): ExamAlias[] {
  return (EXAM_ALIASES[examId] ?? []).map((name) => ({
    name,
    siblings: Object.entries(EXAM_ALIASES)
      .filter(([id, names]) => id !== examId && names.includes(name))
      .map(([id]) => id),
  }))
}
