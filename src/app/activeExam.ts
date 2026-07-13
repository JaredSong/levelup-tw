import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { GENERATED_EXAM_MANIFESTS } from './generatedExamManifests'

export const ACTIVE_EXAM_KEY = 'level-up-active-exam-id'

export const WEB_DESIGN_B_MANIFEST: ExamManifest = {
  examId: 'web-design-b',
  level: '乙級',
  titleZh: '網頁設計乙級',
  titleEn: 'Web Design (Class B)',
  category: '技能檢定',
  version: 'A13',
  sourceUrl: 'https://techbank.wdasec.gov.tw/',
  sourceRevision: '115',
  questionCount: 1365,
  activeQuestionCount: 1360,
  sections: [
    { id: '17300-01', subjectCode: '17300', sourceGroup: 'occupation', titleZh: '作業準備', questionCount: 242, activeQuestionCount: 242 },
    { id: '17300-02', subjectCode: '17300', sourceGroup: 'occupation', titleZh: '應用軟體安裝及使用', questionCount: 405, activeQuestionCount: 405 },
    { id: '17300-03', subjectCode: '17300', sourceGroup: 'occupation', titleZh: '系統軟體安裝及使用', questionCount: 113, activeQuestionCount: 113 },
    { id: '17300-04', subjectCode: '17300', sourceGroup: 'occupation', titleZh: '資訊安全', questionCount: 86, activeQuestionCount: 86 },
    { id: '90011-01', subjectCode: '90011', sourceGroup: 'information-common', titleZh: '電腦概論', questionCount: 20, activeQuestionCount: 20 },
    { id: '90011-02', subjectCode: '90011', sourceGroup: 'information-common', titleZh: '網路概論', questionCount: 29, activeQuestionCount: 29 },
    { id: '90011-03', subjectCode: '90011', sourceGroup: 'information-common', titleZh: '資訊管理概論', questionCount: 10, activeQuestionCount: 10 },
    { id: '90011-04', subjectCode: '90011', sourceGroup: 'information-common', titleZh: '資訊運算思維', questionCount: 20, activeQuestionCount: 20 },
    { id: '90011-05', subjectCode: '90011', sourceGroup: 'information-common', titleZh: '資訊安全概論', questionCount: 40, activeQuestionCount: 40 },
    { id: '90006-01', subjectCode: '90006', sourceGroup: 'general-common', titleZh: '職業安全衛生', questionCount: 100, activeQuestionCount: 100 },
    { id: '90007-01', subjectCode: '90007', sourceGroup: 'general-common', titleZh: '工作倫理與職業道德', questionCount: 100, activeQuestionCount: 100 },
    { id: '90008-03', subjectCode: '90008', sourceGroup: 'general-common', titleZh: '環境保護', questionCount: 100, activeQuestionCount: 95 },
    { id: '90009-04', subjectCode: '90009', sourceGroup: 'general-common', titleZh: '節能減碳', questionCount: 100, activeQuestionCount: 100 },
  ],
  mockRules: {
    totalQuestions: 80,
    singleCount: 60,
    multipleCount: 20,
    durationMinutes: 100,
    passScore: 60,
    maxScore: 100,
    weightSingle: 1,
    weightMultiple: 2,
    subjectQuota: [
      { subjectCode: '17300', count: 55 },
      { subjectCode: '90011', count: 9 },
      { subjectCode: '90006', count: 4 },
      { subjectCode: '90007', count: 4 },
      { subjectCode: '90008', count: 4 },
      { subjectCode: '90009', count: 4 },
    ],
  },
}

export const INSTALLED_EXAMS: ExamManifest[] = [WEB_DESIGN_B_MANIFEST, ...GENERATED_EXAM_MANIFESTS]

export function chooseActiveExamId(exams: Pick<ExamManifest, 'examId'>[], savedExamId: string | null | undefined): string | null {
  if (savedExamId && exams.some((exam) => exam.examId === savedExamId)) return savedExamId
  return exams[0]?.examId ?? null
}

export function formatExamSwitcherItem(exam: ExamManifest, active: boolean) {
  return {
    examId: exam.examId,
    title: exam.titleZh,
    meta: `${exam.category} · ${exam.level} · ${exam.version}`,
    countLabel: zhTW.shell.activeQuestionCount(exam.activeQuestionCount),
    statusLabel: active ? zhTW.shell.activeOffline : zhTW.shell.installedOffline,
  }
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

export function saveActiveExamId(examId: string, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(ACTIVE_EXAM_KEY, examId)
}
