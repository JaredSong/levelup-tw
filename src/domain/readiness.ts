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

const MOCK_TOTAL = 80
const COMMON_PER_SUBJECT = 4 // four questions from each general subject (16 total)
const OCCUPATION_IN_MOCK = 55 // 17300 share of an 80-question mock
const GENERIC_OCCUPATION_IN_MOCK = 64 // occupation share when only the four general common subjects are mixed in
const HAIRDRESSING_OCCUPATION_IN_MOCK = 60 // 06000/06700 share while hair packs are single-answer mocks
const INFO_IN_MOCK = 9 // 90011 share of an 80-question mock
const BEAUTY_HAIR_COMMON_IN_MOCK = 4 // 90012 share in the current hairdressing pack mock
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

  // Each subject's mock share is split across its sections by size: 17300 → 55/80,
  // 90011 → 9/80, and each of the four general subjects → 4/80.
  const occupationTotal = questions.filter((question) => question.sourceGroup === 'occupation').length
  const infoTotal = questions.filter((question) => question.sourceGroup === 'information-common').length
  const beautyHairTotal = questions.filter((question) => question.sourceGroup === 'beauty-hair-common').length
  const isHairdressingPack = questions.some((question) => ['06000', '06700'].includes(question.subjectCode ?? ''))

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

    let weight: number
    if (kind === 'general-common') weight = COMMON_PER_SUBJECT / MOCK_TOTAL
    else if (kind === 'information-common') weight = infoTotal ? (total / infoTotal) * (INFO_IN_MOCK / MOCK_TOTAL) : 0
    else if (kind === 'beauty-hair-common') weight = beautyHairTotal ? (total / beautyHairTotal) * (BEAUTY_HAIR_COMMON_IN_MOCK / MOCK_TOTAL) : 0
    else {
      const occupationShare = isHairdressingPack
        ? HAIRDRESSING_OCCUPATION_IN_MOCK
        : infoTotal
          ? OCCUPATION_IN_MOCK
          : GENERIC_OCCUPATION_IN_MOCK
      weight = occupationTotal ? (total / occupationTotal) * (occupationShare / MOCK_TOTAL) : 0
    }

    groups.push({
      section,
      label: sample.sectionTitle ?? section,
      subjectCode: sample.subjectCode ?? '',
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
