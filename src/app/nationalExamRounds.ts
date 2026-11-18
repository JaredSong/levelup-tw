// Which 梯次 each exam runs in. Not every exam runs in every round: the year's
// round table assigns levels per round and moves some exams to 即測即評 only.
// A site-wide "next round" date on an exam page is therefore a wrong claim for
// every exam that round doesn't cover — exam pages read this table instead.
//
// Source: 技能檢定中心公告「116年度全國技術士技能檢定之梯次、職類級別、報名及測試
// 等相關事項」(115.8.28 公告, 115.11.13 修正), annex 二、6. 一般職類. Rows are
// read per exam (code + level); a shared bank follows its sub-items
// (會計事務 14900 → 14901/14902, 烘焙食品 07700 → 07705/07721/07725, all 丙 in
// round 3). An empty list means the exam is not in the 116 national exam
// (工業電子丙、工業配線丙: 全國檢定不開辦，納入即測即評及發證).
//
// Every published exam must have an entry (nationalExamRounds.test.ts), so a
// new pack can't ship without its rounds being read from the table.

export type ExamRound = 1 | 2 | 3

export const NATIONAL_EXAM_ROUNDS_SOURCE_116 =
  'https://www.wdasec.gov.tw/News_Content.aspx?n=F240F6BB01FE46BA&s=2E98B26912AA4F97&sms=DD855C7DF840A224'

export const NATIONAL_EXAM_ROUNDS_116: Record<string, ExamRound[]> = {
  'accounting-c': [3],
  'aircraft-maintenance-c': [3],
  'baking-food-c': [3],
  'beauty-b': [2],
  'beauty-c': [1, 2, 3],
  'beverage-preparation-c': [2],
  'car-repair-c': [3],
  'care-service-single': [1, 2, 3],
  'chemistry-c': [3],
  'childcare-single': [1, 3],
  'chinese-cooking-meat-b': [1, 3],
  'chinese-cooking-meat-c': [1, 2, 3],
  'chinese-cooking-vegetarian-c': [1, 2, 3],
  'cnc-milling-b': [3],
  'computer-hardware-repair-b': [3],
  'computer-hardware-repair-c': [1],
  'computer-software-application-b': [3],
  'computer-software-application-c': [1],
  'digital-electronics-b': [3],
  'dining-service-c': [1, 2],
  'electrical-equipment-inspection-c': [1],
  'employment-service-b': [1, 2, 3],
  'engineering-surveying-b': [3],
  'excavator-operation-single': [2],
  'folk-massage-single': [1],
  'food-analysis-c': [1],
  'forklift-operation-single': [1, 2, 3],
  'funeral-service-b': [1, 3],
  'funeral-service-c': [1],
  'heat-treatment-c': [1],
  'horticulture-c': [1],
  'indoor-wiring-b': [1, 3],
  'indoor-wiring-c': [3],
  'industrial-electronics-c': [],
  'industrial-wiring-c': [],
  'interior-decoration-management-b': [3],
  'international-trade-c': [1, 2],
  'loader-operation-single': [2],
  'machining-c': [3],
  'man-haircut-c': [1, 2],
  'motorcycle-repair-c': [3],
  'network-installation-c': [1],
  'occupational-hygiene-management-a': [1, 2, 3],
  'occupational-safety-health-management-b': [1, 2, 3],
  'occupational-safety-management-a': [1, 2, 3],
  'pressure-vessel-operation-single': [1, 2, 3],
  'retail-service-c': [1],
  'surveying-c': [3],
  'visual-communication-design-c': [3],
  'water-pipe-fitting-c': [1, 2, 3],
  'web-design-b': [2],
  'western-cooking-c': [2],
  'women-hairdressing-c': [1, 3],
}

/** Rounds per year for which we have read the per-exam table. */
export const NATIONAL_EXAM_ROUNDS: Record<number, Record<string, ExamRound[]>> = {
  116: NATIONAL_EXAM_ROUNDS_116,
}
