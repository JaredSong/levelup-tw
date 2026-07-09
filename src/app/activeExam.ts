import type { ExamManifest } from '../core/exam'

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

export const INSTALLED_EXAMS: ExamManifest[] = [WEB_DESIGN_B_MANIFEST]

export function chooseActiveExamId(exams: Pick<ExamManifest, 'examId'>[], savedExamId: string | null | undefined): string | null {
  if (savedExamId && exams.some((exam) => exam.examId === savedExamId)) return savedExamId
  return exams[0]?.examId ?? null
}

export function formatExamSwitcherItem(exam: ExamManifest, active: boolean) {
  return {
    examId: exam.examId,
    title: exam.titleZh,
    meta: `${exam.category} · ${exam.level} · ${exam.version}`,
    countLabel: `${exam.activeQuestionCount.toLocaleString()} active questions`,
    statusLabel: `${active ? 'Active' : 'Installed'} · Offline`,
  }
}

export function readSavedActiveExamId(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  return storage.getItem(ACTIVE_EXAM_KEY)
}

export function saveActiveExamId(examId: string, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(ACTIVE_EXAM_KEY, examId)
}
