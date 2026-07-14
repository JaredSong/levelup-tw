export interface NationalExamScheduleEntry {
  id: string
  year: 115
  round: 1 | 2 | 3
  label: string
  writtenDate: string
  registrationStart: string
  registrationEnd: string
}

export const NATIONAL_EXAM_SCHEDULE_SOURCE = 'https://skill.tcte.edu.tw/doc/YR115/115Skill_reg_20260401.pdf'

export const NATIONAL_EXAM_SCHEDULE_115: NationalExamScheduleEntry[] = [
  {
    id: '115-1',
    year: 115,
    round: 1,
    label: '115年度第1梯次',
    writtenDate: '2026-03-15',
    registrationStart: '2026-01-02',
    registrationEnd: '2026-01-13',
  },
  {
    id: '115-2',
    year: 115,
    round: 2,
    label: '115年度第2梯次',
    writtenDate: '2026-07-05',
    registrationStart: '2026-04-24',
    registrationEnd: '2026-05-05',
  },
  {
    id: '115-3',
    year: 115,
    round: 3,
    label: '115年度第3梯次',
    writtenDate: '2026-11-08',
    registrationStart: '2026-08-27',
    registrationEnd: '2026-09-07',
  },
]

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isScheduleEntryPast(entry: Pick<NationalExamScheduleEntry, 'writtenDate'>, now: Date) {
  const examDate = new Date(`${entry.writtenDate}T00:00:00`)
  if (Number.isNaN(examDate.getTime())) return false
  return startOfLocalDay(examDate).getTime() < startOfLocalDay(now).getTime()
}

export function getNextNationalExamEntry(now: Date, entries = NATIONAL_EXAM_SCHEDULE_115) {
  return entries.find((entry) => !isScheduleEntryPast(entry, now)) ?? null
}
