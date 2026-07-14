import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { GENERATED_EXAM_MANIFESTS } from './generatedExamManifests'
import WEB_DESIGN_B_MANIFEST_JSON from '../../public/data/exams/web-design-b/manifest.json'

export const ACTIVE_EXAM_KEY = 'level-up-active-exam-id'
export const SELECTED_EXAMS_KEY = 'level-up-selected-exam-ids'

export const WEB_DESIGN_B_MANIFEST = WEB_DESIGN_B_MANIFEST_JSON as ExamManifest

export const INSTALLED_EXAMS: ExamManifest[] = [WEB_DESIGN_B_MANIFEST, ...GENERATED_EXAM_MANIFESTS]

function uniqueValidExamIds(exams: Pick<ExamManifest, 'examId'>[], ids: string[]): string[] {
  const validIds = new Set(exams.map((exam) => exam.examId))
  const seen = new Set<string>()
  return ids.filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function chooseActiveExamId(exams: Pick<ExamManifest, 'examId'>[], savedExamId: string | null | undefined): string | null {
  if (savedExamId && exams.some((exam) => exam.examId === savedExamId)) return savedExamId
  return exams[0]?.examId ?? null
}

export function chooseSelectedExamIds(
  exams: Pick<ExamManifest, 'examId'>[],
  savedExamIds: string[] | null | undefined,
  activeExamId: string | null | undefined,
): string[] {
  const selected = uniqueValidExamIds(exams, savedExamIds ?? [])
  const fallback = activeExamId && exams.some((exam) => exam.examId === activeExamId)
    ? activeExamId
    : exams[0]?.examId

  if (fallback && !selected.includes(fallback)) selected.unshift(fallback)
  return selected
}

export function formatExamSwitcherItem(exam: ExamManifest, active: boolean) {
  return {
    examId: exam.examId,
    title: exam.titleZh,
    meta: `${exam.category} · ${exam.level} · ${exam.version}`,
    countLabel: zhTW.shell.activeQuestionCount(exam.activeQuestionCount),
    statusLabel: active ? zhTW.shell.activeOffline : zhTW.shell.installedOffline,
    integrityLabel: formatIntegrityLabel(exam),
  }
}

export function formatIntegrityLabel(exam: Pick<ExamManifest, 'integrity'>): string {
  if (exam.integrity?.status === 'fully_verified') return zhTW.shell.integrityFullyVerified
  if (exam.integrity?.status === 'spot_checked') return zhTW.shell.integritySpotChecked
  return zhTW.shell.integrityUnchecked
}

export function formatCurrentBankLabel(exam: Pick<ExamManifest, 'titleZh' | 'version'>): string {
  return `${exam.titleZh} ${exam.version}`
}

export interface SyllabusItem {
  code: string
  label: string
  meta: string
}

function labelForSourceGroup(sourceGroup: ExamManifest['sections'][number]['sourceGroup']): string {
  if (sourceGroup === 'general-common') return '共同科目'
  if (sourceGroup === 'information-common') return '資訊共同科目'
  if (sourceGroup === 'beauty-hair-common') return '美容美髮共同科目'
  return '專業科目'
}

export function formatSyllabusItems(exam: ExamManifest): SyllabusItem[] {
  const bySubject = new Map<string, {
    activeQuestionCount: number
    sectionCount: number
    sourceGroup: ExamManifest['sections'][number]['sourceGroup']
    firstTitle: string
  }>()

  for (const section of exam.sections) {
    const current = bySubject.get(section.subjectCode) ?? {
      activeQuestionCount: 0,
      sectionCount: 0,
      sourceGroup: section.sourceGroup,
      firstTitle: section.titleZh,
    }
    current.activeQuestionCount += section.activeQuestionCount
    current.sectionCount += 1
    bySubject.set(section.subjectCode, current)
  }

  return [...bySubject.entries()].map(([code, item]) => {
    const isOccupation = item.sourceGroup === 'occupation'
    return {
      code,
      label: isOccupation ? `${exam.titleZh.replace(exam.level, '')}專業科目` : item.firstTitle,
      meta: isOccupation
        ? `${item.activeQuestionCount.toLocaleString()} 題 · ${item.sectionCount} 個工作項目`
        : `${item.activeQuestionCount.toLocaleString()} 題 · ${labelForSourceGroup(item.sourceGroup) === '共同科目' ? item.firstTitle : labelForSourceGroup(item.sourceGroup)}`,
    }
  })
}

export function formatMockFormatHint(exam: ExamManifest): string {
  const parts = []
  if (exam.mockRules.singleCount) parts.push(`${exam.mockRules.singleCount} 題單選`)
  if (exam.mockRules.multipleCount) parts.push(`${exam.mockRules.multipleCount} 題複選`)

  const occupationCodes = new Set(
    exam.sections
      .filter((section) => section.sourceGroup === 'occupation')
      .map((section) => section.subjectCode),
  )
  const occupationQuota = exam.mockRules.subjectQuota.find((quota) => occupationCodes.has(quota.subjectCode))
  if (occupationQuota) parts.push(`${occupationQuota.subjectCode} 專業科目 ${occupationQuota.count} 題`)

  const commonQuotas = exam.mockRules.subjectQuota.filter((quota) => !occupationCodes.has(quota.subjectCode))
  const commonCounts = new Set(commonQuotas.map((quota) => quota.count))
  if (commonQuotas.length && commonCounts.size === 1) parts.push(`共同科目各 ${commonQuotas[0].count} 題`)
  else {
    for (const quota of commonQuotas) parts.push(`${quota.subjectCode} ${quota.count} 題`)
  }

  return parts.join(' · ')
}

export function homeStudyCopyForExam(exam: Pick<ExamManifest, 'examId'>) {
  if (exam.examId === 'employment-service-b') {
    return {
      subtitle: '就服法規、勞動法令、職涯諮詢、人力仲介',
      continueFrom: '繼續練法規題庫',
      startSmallFreshSet: '先做一小組新題，累積法規手感。',
      shortSessionTitle: '以模擬分數當主指標。',
      shortSessionBody: '這科沒有術科；練題、錯題、記憶複習和 80 題模擬就是完整備考主線。',
    }
  }

  return {
    subtitle: zhTW.home.subtitle,
    continueFrom: zhTW.home.continueFrom,
    startSmallFreshSet: zhTW.home.startSmallFreshSet,
    shortSessionTitle: zhTW.home.shortSessionTitle,
    shortSessionBody: zhTW.home.shortSessionBody,
  }
}

export function readSavedActiveExamId(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  return storage.getItem(ACTIVE_EXAM_KEY)
}

export function readSelectedExamIds(storage: Pick<Storage, 'getItem'> = localStorage): string[] | null {
  const raw = storage.getItem(SELECTED_EXAMS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null
  } catch {
    return null
  }
}

export function saveActiveExamId(examId: string, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(ACTIVE_EXAM_KEY, examId)
}

export function saveSelectedExamIds(examIds: string[], storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(SELECTED_EXAMS_KEY, JSON.stringify(examIds))
}
