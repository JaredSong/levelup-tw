import type { MockRules } from '../core/exam'
import type { Progress, Question } from './studyEngine'
import type { AttemptRecord } from '../storage/db'

export type GroupStatus = 'weak' | 'building' | 'ready'

export interface GroupReadiness {
  section: string
  label: string
  subjectCode: string
  kind: 'occupation' | 'information-common' | 'beauty-hair-common' | 'general-common'
  total: number
  attempted: number
  coverage: number
  mastery: number
  recentAccuracy: number | null // null when the group has no attempts yet
  recentCount: number
  status: GroupStatus
  weight: number
}

export interface Readiness {
  groups: GroupReadiness[]
  overall: number
}

const RECENT_WINDOW = 20
const PASS = 0.6
const READY = 0.8

// Per-group readiness blends coverage, recent accuracy, and mastery.
function readinessValue(group: GroupReadiness): number {
  return 0.4 * group.coverage + 0.4 * (group.recentAccuracy ?? 0) + 0.2 * group.mastery
}

export function computeReadiness(
  questions: Question[],
  progressById: Record<string, Progress>,
  attempts: AttemptRecord[],
  mockRules: Pick<MockRules, 'totalQuestions' | 'subjectQuota'>,
): Readiness {
  const sectionOf = new Map<string, string>()
  const grouped = new Map<string, Question[]>()
  for (const question of questions) {
    sectionOf.set(question.id, question.section)
    const list = grouped.get(question.section) ?? []
    list.push(question)
    grouped.set(question.section, list)
  }

  const attemptsBySection = new Map<string, AttemptRecord[]>()
  for (const attempt of attempts) {
    const section = sectionOf.get(attempt.questionId)
    if (!section) continue
    const list = attemptsBySection.get(section) ?? []
    list.push(attempt)
    attemptsBySection.set(section, list)
  }

  // Each subject's mock share comes from the pack's official composition
  // (manifest.mockRules.subjectQuota) and is split across the subject's
  // sections by size. No per-trade constants: they drifted once the catalog
  // grew past the packs they were written for (90011 is 9/80 in 網頁設計乙級
  // but 4/80 in 電腦軟體應用丙級). A subject the mock never draws weighs 0.
  const quotaBySubject = new Map(mockRules.subjectQuota.map((entry) => [entry.subjectCode, entry.count]))
  const totalBySubject = new Map<string, number>()
  for (const question of questions) {
    const code = question.subjectCode ?? ''
    totalBySubject.set(code, (totalBySubject.get(code) ?? 0) + 1)
  }

  const groups: GroupReadiness[] = []
  for (const [section, qs] of grouped) {
    const sample = qs[0]
    const kind = sample.sourceGroup ?? 'occupation'
    const total = qs.length
    const attempted = qs.filter((q) => (progressById[q.id]?.attempts ?? 0) > 0).length
    const mastered = qs.filter((q) => (progressById[q.id]?.streak ?? 0) >= 2).length
    const coverage = total ? attempted / total : 0
    const mastery = total ? mastered / total : 0

    const recent = (attemptsBySection.get(section) ?? [])
      .slice()
      .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
      .slice(0, RECENT_WINDOW)
    const recentCount = recent.length
    const recentAccuracy = recentCount ? recent.filter((a) => a.correct).length / recentCount : null

    const acc = recentAccuracy ?? 0
    let status: GroupStatus
    if (coverage < PASS || acc < PASS) status = 'weak'
    else if (coverage >= READY && acc >= READY) status = 'ready' // ready implies <=20% unseen
    else status = 'building'

    const subjectCode = sample.subjectCode ?? ''
    const subjectTotal = totalBySubject.get(subjectCode) ?? 0
    const subjectShare = mockRules.totalQuestions
      ? (quotaBySubject.get(subjectCode) ?? 0) / mockRules.totalQuestions
      : 0
    const weight = subjectTotal ? (total / subjectTotal) * subjectShare : 0

    groups.push({
      section,
      label: sample.sectionTitle ?? section,
      subjectCode,
      kind,
      total,
      attempted,
      coverage,
      mastery,
      recentAccuracy,
      recentCount,
      status,
      weight,
    })
  }

  const weightSum = groups.reduce((sum, g) => sum + g.weight, 0)
  const overall = weightSum ? groups.reduce((sum, g) => sum + g.weight * readinessValue(g), 0) / weightSum : 0

  const rank: Record<GroupStatus, number> = { weak: 0, building: 1, ready: 2 }
  groups.sort((a, b) => rank[a.status] - rank[b.status] || b.weight - a.weight)

  return { groups, overall }
}
