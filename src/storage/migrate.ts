import type { Transaction } from 'dexie'
import type { ReviewCard, ReviewLog } from '../core/contracts'
import { isQuestionKey, questionKey, QUESTION_KEY_SEPARATOR } from '../core/exam'
import type { Progress } from '../domain/studyEngine'
import type { AttemptRecord, ExplanationRecord } from './db'
import type { BackupData } from './merge'

/**
 * Every record written before the questionKey migration belongs to the original
 * 網頁設計乙級 bank by construction. Data provenance is fixed, so this must NOT
 * read the user's current exam selection (`level-up-active-exam-id`).
 */
export const LEGACY_EXAM_ID = 'web-design-b'
export const EMPLOYMENT_SERVICE_REVISION_KEY = 'level-up-content-revision:employment-service-b'
export const EMPLOYMENT_SERVICE_CURRENT_REVISION = 'A17'
export const EMPLOYMENT_SERVICE_LEGACY_EXAM_ID = 'employment-service-b-legacy-a19'

const EMPLOYMENT_SERVICE_EXAM_ID = 'employment-service-b'

function archiveQuestionKey(value: string): string {
  const prefix = `${EMPLOYMENT_SERVICE_EXAM_ID}${QUESTION_KEY_SEPARATOR}`
  return value.startsWith(prefix)
    ? `${EMPLOYMENT_SERVICE_LEGACY_EXAM_ID}${QUESTION_KEY_SEPARATOR}${value.slice(prefix.length)}`
    : value
}

function archiveCardKey(value: string): string {
  return value.replace(
    `question:${EMPLOYMENT_SERVICE_EXAM_ID}${QUESTION_KEY_SEPARATOR}`,
    `question:${EMPLOYMENT_SERVICE_LEGACY_EXAM_ID}${QUESTION_KEY_SEPARATOR}`,
  )
}

/**
 * A locally imported 2018 bank was mislabeled A19. The official A17 revision
 * renumbers most questions, so old numeric ids cannot safely share mastery with
 * the new content. Keep the history, but move it to a non-active namespace.
 */
export function archiveEmploymentServiceA19Backup(data: BackupData): BackupData {
  if (data.local?.[EMPLOYMENT_SERVICE_REVISION_KEY] === EMPLOYMENT_SERVICE_CURRENT_REVISION) return data
  return {
    ...data,
    progress: data.progress?.map((row) => ({ ...row, questionId: archiveQuestionKey(row.questionId) })),
    attempts: data.attempts?.map((row) => ({ ...row, questionId: archiveQuestionKey(row.questionId) })),
    results: data.results?.map((row) => ({
      ...row,
      examId: row.examId === EMPLOYMENT_SERVICE_EXAM_ID ? EMPLOYMENT_SERVICE_LEGACY_EXAM_ID : row.examId,
    })),
    explanations: data.explanations?.map((row) => ({ ...row, questionId: archiveQuestionKey(row.questionId) })),
    reviewCards: data.reviewCards?.map((card) => card.examId === EMPLOYMENT_SERVICE_EXAM_ID ? {
      ...card,
      id: archiveCardKey(card.id),
      examId: EMPLOYMENT_SERVICE_LEGACY_EXAM_ID,
      atomId: archiveCardKey(card.atomId),
      questionKeys: card.questionKeys.map(archiveQuestionKey),
    } : card),
    reviewLogs: data.reviewLogs?.map((log) => log.examId === EMPLOYMENT_SERVICE_EXAM_ID ? {
      ...log,
      cardId: archiveCardKey(log.cardId),
      examId: EMPLOYMENT_SERVICE_LEGACY_EXAM_ID,
    } : log),
    local: { ...(data.local ?? {}), [EMPLOYMENT_SERVICE_REVISION_KEY]: EMPLOYMENT_SERVICE_CURRENT_REVISION },
  } as BackupData
}

/** Namespace a bare progress/attempt question id; already-namespaced keys pass through. */
export function namespaceQuestionId(id: string, examId = LEGACY_EXAM_ID): string {
  return isQuestionKey(id) ? id : questionKey(examId, id)
}

/**
 * Explanation cache keys are composite (`<id>::<style>::<selected>::<options>::<version>`)
 * and already contain ":", so `isQuestionKey` false-positives on them. The id part is
 * everything before the first "::" — it contains ":" only once namespaced.
 */
export function namespaceExplanationKey(key: string, examId = LEGACY_EXAM_ID): string {
  const doubleAt = key.indexOf(`${QUESTION_KEY_SEPARATOR}${QUESTION_KEY_SEPARATOR}`)
  const idPart = doubleAt === -1 ? key : key.slice(0, doubleAt)
  return isQuestionKey(idPart) ? key : questionKey(examId, key)
}

/**
 * Normalize a snapshot to namespaced keys. Idempotent, so it is safe to apply to
 * every sync pull and backup import — old-device bare records and their namespaced
 * twins converge to the same key and dedupe in the merge.
 */
export function normalizeBackupData(data: BackupData, examId = LEGACY_EXAM_ID): BackupData {
  return archiveEmploymentServiceA19Backup({
    ...data,
    // Old backup files can miss whole sections; keep absent arrays absent so
    // writeData's per-table guards behave the same as before.
    progress: data.progress?.map((row) => ({ ...row, questionId: namespaceQuestionId(row.questionId, examId) })),
    attempts: data.attempts?.map((row) => ({ ...row, questionId: namespaceQuestionId(row.questionId, examId) })),
    results: data.results?.map((row) => ({ ...row, examId: row.examId ?? examId })),
    explanations: data.explanations?.map((row) => ({ ...row, questionId: namespaceExplanationKey(row.questionId, examId) })),
  } as BackupData)
}

/**
 * Dexie v3 upgrade: rewrite bare question ids to `examId:questionId` keys.
 * Runs inside the versionchange transaction, so an interrupted upgrade rolls back
 * atomically and re-runs on the next open. Each rewrite is also guarded, so a
 * partially-namespaced state (e.g. restored from a mixed backup) migrates cleanly.
 */
export async function migrateTablesToQuestionKeys(tx: Transaction, examId = LEGACY_EXAM_ID): Promise<void> {
  // progress/explanations key on questionId itself; changing a primary key's value
  // requires delete + re-add.
  const progressTable = tx.table<Progress, string>('progress')
  const bareProgress = (await progressTable.toArray()).filter((row) => !isQuestionKey(row.questionId))
  if (bareProgress.length) {
    await progressTable.bulkDelete(bareProgress.map((row) => row.questionId))
    await progressTable.bulkPut(bareProgress.map((row) => ({ ...row, questionId: questionKey(examId, row.questionId) })))
  }

  // attempts use an auto-increment id, so the rows can be modified in place.
  await tx.table<AttemptRecord, number>('attempts').toCollection().modify((attempt) => {
    attempt.questionId = namespaceQuestionId(attempt.questionId, examId)
  })

  const explanationsTable = tx.table<ExplanationRecord, string>('explanations')
  const bareExplanations = (await explanationsTable.toArray())
    .filter((row) => namespaceExplanationKey(row.questionId, examId) !== row.questionId)
  if (bareExplanations.length) {
    await explanationsTable.bulkDelete(bareExplanations.map((row) => row.questionId))
    await explanationsTable.bulkPut(bareExplanations.map((row) => ({ ...row, questionId: namespaceExplanationKey(row.questionId, examId) })))
  }

  await tx.table<{ examId?: string }, number>('results').toCollection().modify((result) => {
    result.examId = result.examId ?? examId
  })
}

/** Dexie v6 counterpart of archiveEmploymentServiceA19Backup. */
export async function archiveEmploymentServiceA19Tables(tx: Transaction): Promise<void> {
  const progressTable = tx.table<Progress, string>('progress')
  const progress = (await progressTable.toArray()).filter((row) => archiveQuestionKey(row.questionId) !== row.questionId)
  if (progress.length) {
    await progressTable.bulkDelete(progress.map((row) => row.questionId))
    await progressTable.bulkPut(progress.map((row) => ({ ...row, questionId: archiveQuestionKey(row.questionId) })))
  }

  await tx.table<AttemptRecord, number>('attempts').toCollection().modify((row) => {
    row.questionId = archiveQuestionKey(row.questionId)
  })

  const explanationsTable = tx.table<ExplanationRecord, string>('explanations')
  const explanations = (await explanationsTable.toArray()).filter((row) => archiveQuestionKey(row.questionId) !== row.questionId)
  if (explanations.length) {
    await explanationsTable.bulkDelete(explanations.map((row) => row.questionId))
    await explanationsTable.bulkPut(explanations.map((row) => ({ ...row, questionId: archiveQuestionKey(row.questionId) })))
  }

  await tx.table<{ examId: string }, number>('results').toCollection().modify((row) => {
    if (row.examId === EMPLOYMENT_SERVICE_EXAM_ID) row.examId = EMPLOYMENT_SERVICE_LEGACY_EXAM_ID
  })

  const cardsTable = tx.table<ReviewCard, string>('reviewCards')
  const cards = (await cardsTable.toArray()).filter((card) => card.examId === EMPLOYMENT_SERVICE_EXAM_ID)
  if (cards.length) {
    await cardsTable.bulkDelete(cards.map((card) => card.id))
    await cardsTable.bulkPut(cards.map((card) => ({
      ...card,
      id: archiveCardKey(card.id),
      examId: EMPLOYMENT_SERVICE_LEGACY_EXAM_ID,
      atomId: archiveCardKey(card.atomId),
      questionKeys: card.questionKeys.map(archiveQuestionKey),
    })))
  }

  await tx.table<ReviewLog, string>('reviewLogs').toCollection().modify((log) => {
    if (log.examId !== EMPLOYMENT_SERVICE_EXAM_ID) return
    log.examId = EMPLOYMENT_SERVICE_LEGACY_EXAM_ID
    log.cardId = archiveCardKey(log.cardId)
  })
}
