import { BANK_REVISIONS } from '../app/bankRevisions'
import { applyBankRevision, BANK_REVISION_KEY, pendingRevisionIds, type BankRevisionImpact } from './bankRevision'
import type { BackupData } from './merge'

export const BANK_NOTICE_KEY = 'level-up-bank-notice'
const ORDER = BANK_REVISIONS.map((revision) => revision.id)
export const LATEST_BANK_REVISION = ORDER.at(-1) ?? null

export async function loadBankRevisions(ids: string[]) {
  return Promise.all(ids.map((id) => BANK_REVISIONS.find((revision) => revision.id === id)!.load()))
}

/**
 * Bring a backup or cloud-sync copy up to the current bank revisions before it
 * is merged or written. Copies without a marker predate every revision.
 */
export async function applyPendingBankRevisions(data: BackupData): Promise<BackupData> {
  const pending = pendingRevisionIds(ORDER, data.local?.[BANK_REVISION_KEY])
  let next = data
  for (const revision of await loadBankRevisions(pending)) next = applyBankRevision(next, revision).data
  return next
}

/** Packs whose bank changed under this learner's saved data, per revision. */
export interface BankNotice {
  revision: string
  effectiveFrom: string
  exams: Record<string, BankRevisionImpact>
}

export function readBankNotices(): BankNotice[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BANK_NOTICE_KEY) ?? '[]') as BankNotice[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordBankNotice(revision: string, effectiveFrom: string, exams: Record<string, BankRevisionImpact>): void {
  if (!Object.keys(exams).length) return
  const notices = readBankNotices().filter((notice) => notice.revision !== revision)
  localStorage.setItem(BANK_NOTICE_KEY, JSON.stringify([...notices, { revision, effectiveFrom, exams }]))
}

/** The learner has read the notice for this pack; drop it everywhere. */
export function dismissBankNotice(examId: string): void {
  const notices = readBankNotices()
    .map((notice) => ({ ...notice, exams: Object.fromEntries(Object.entries(notice.exams).filter(([id]) => id !== examId)) }))
    .filter((notice) => Object.keys(notice.exams).length)
  if (notices.length) localStorage.setItem(BANK_NOTICE_KEY, JSON.stringify(notices))
  else localStorage.removeItem(BANK_NOTICE_KEY)
}

/** Unread notice for one pack, merged across revisions (newest one named). */
export function bankNoticeFor(examId: string): { revision: string; effectiveFrom: string; impact: BankRevisionImpact } | null {
  const hits = readBankNotices().filter((notice) => notice.exams[examId])
  if (!hits.length) return null
  const sum = (field: keyof BankRevisionImpact) => hits.reduce((total, notice) => total + notice.exams[examId][field], 0)
  const latest = hits[hits.length - 1]
  return { revision: latest.revision, effectiveFrom: latest.effectiveFrom, impact: { archived: sum('archived'), moved: sum('moved'), added: sum('added') } }
}

export { pendingRevisionIds, ORDER as BANK_REVISION_ORDER }
