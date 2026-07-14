import type { Transaction } from 'dexie'
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
  return {
    ...data,
    // Old backup files can miss whole sections; keep absent arrays absent so
    // writeData's per-table guards behave the same as before.
    progress: data.progress?.map((row) => ({ ...row, questionId: namespaceQuestionId(row.questionId, examId) })),
    attempts: data.attempts?.map((row) => ({ ...row, questionId: namespaceQuestionId(row.questionId, examId) })),
    results: data.results?.map((row) => ({ ...row, examId: row.examId ?? examId })),
    explanations: data.explanations?.map((row) => ({ ...row, questionId: namespaceExplanationKey(row.questionId, examId) })),
  } as BackupData
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
