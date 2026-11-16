import type { ReviewCard, ReviewLog } from '../core/contracts'
import { QUESTION_KEY_SEPARATOR } from '../core/exam'
import type { Progress } from '../domain/studyEngine'
import type { AttemptRecord, ExplanationRecord } from './db'
import type { BackupData } from './merge'

/**
 * A bank revision is an official question-bank version change (e.g. the 116
 * banks). Question ids are official numbers, and a new version can put a
 * different question under the same number — so saved progress must be
 * rewritten once per revision, never matched by number alone.
 *
 * scripts/bankRevisions.mjs compares every pack with the version learners
 * studied and records, per pack, which old ids now hold an identical question
 * under another id (`moved`: progress follows it) and which no longer exist as
 * that question (`retired`: progress is archived under a non-active exam id,
 * so it is kept but never shown against whatever now holds that number).
 */
export interface BankChangeSet {
  retired: string[]
  moved: [string, string][]
}

export interface BankRevisionExam {
  /** Change-set ids (one per bank subject) that apply to this pack. */
  sets: string[]
  kept: number
  moved: number
  retired: number
  /** Questions in the new pack whose content did not exist before. */
  added: number
  total: number
}

export interface BankRevision {
  id: string
  /** First official exam day the new banks apply to (YYYY-MM-DD). */
  effectiveFrom: string
  sets: Record<string, BankChangeSet>
  exams: Record<string, BankRevisionExam>
}

/** Last applied revision id; carried in backups and cloud sync copies. */
export const BANK_REVISION_KEY = 'level-up-bank-revision'

export function archivedExamId(examId: string, revisionId: string): string {
  return `${examId}@before-${revisionId}`
}

/** Per pack: how this learner's saved data was affected (drives the notice). */
export interface BankRevisionImpact {
  /** Questions with saved progress or a review card whose record was archived. */
  archived: number
  /** Questions whose record followed the question to its new number. */
  moved: number
  /** New or rewritten questions in the pack (pack-level, not this learner's). */
  added: number
}

type Rewrite = { key: string; archived: boolean; examId: string } | null

/** Build a questionKey rewriter for one revision. Returns null for untouched keys. */
export function keyRewriter(revision: BankRevision): (key: string) => Rewrite {
  const byExam = new Map<string, { retired: Set<string>; moved: Map<string, string> }>()
  for (const [examId, exam] of Object.entries(revision.exams)) {
    const retired = new Set<string>()
    const moved = new Map<string, string>()
    for (const setId of exam.sets) {
      const set = revision.sets[setId]
      set.retired.forEach((id) => retired.add(id))
      set.moved.forEach(([from, to]) => moved.set(from, to))
    }
    byExam.set(examId, { retired, moved })
  }
  return (key) => {
    const at = key.indexOf(QUESTION_KEY_SEPARATOR)
    if (at === -1) return null
    const examId = key.slice(0, at)
    const id = key.slice(at + QUESTION_KEY_SEPARATOR.length)
    const exam = byExam.get(examId)
    if (!exam) return null
    if (exam.retired.has(id)) return { key: `${archivedExamId(examId, revision.id)}${QUESTION_KEY_SEPARATOR}${id}`, archived: true, examId }
    const to = exam.moved.get(id)
    if (to) return { key: `${examId}${QUESTION_KEY_SEPARATOR}${to}`, archived: false, examId }
    return null
  }
}

const CARD_PREFIX = 'question:'
const EXPLANATION_SEPARATOR = `${QUESTION_KEY_SEPARATOR}${QUESTION_KEY_SEPARATOR}`

function splitExplanationKey(value: string): [string, string] {
  const at = value.indexOf(EXPLANATION_SEPARATOR)
  return at === -1 ? [value, ''] : [value.slice(0, at), value.slice(at)]
}

/**
 * Rewrite every question-scoped record for one revision. Pure: returns new
 * arrays plus the per-pack impact. Records of untouched questions, session
 * results, and device-local keys pass through unchanged.
 */
export function applyBankRevision(data: BackupData, revision: BankRevision): { data: BackupData; impact: Record<string, BankRevisionImpact> } {
  const rewrite = keyRewriter(revision)
  const impact: Record<string, BankRevisionImpact> = {}
  const touched = new Map<string, Set<string>>() // examId → question keys seen (archived or moved)
  const blank = (examId: string): BankRevisionImpact => ({ archived: 0, moved: 0, added: revision.exams[examId].added })
  const note = (r: NonNullable<Rewrite>, originalKey: string) => {
    impact[r.examId] ??= blank(r.examId)
    const seen = touched.get(r.examId) ?? new Set<string>()
    touched.set(r.examId, seen)
    if (seen.has(originalKey)) return
    seen.add(originalKey)
    if (r.archived) impact[r.examId].archived += 1
    else impact[r.examId].moved += 1
  }
  // Every pack the learner has any record in gets an impact entry, so the
  // notice reaches them even if none of their questions changed.
  const studied = (key: string) => {
    const examId = key.slice(0, key.indexOf(QUESTION_KEY_SEPARATOR))
    if (revision.exams[examId]) impact[examId] ??= blank(examId)
  }

  const progress = data.progress?.map((row): Progress => {
    studied(row.questionId)
    const r = rewrite(row.questionId)
    if (!r) return row
    note(r, row.questionId)
    return { ...row, questionId: r.key }
  })
  const attempts = data.attempts?.map((row): AttemptRecord => {
    const r = rewrite(row.questionId)
    return r ? { ...row, questionId: r.key } : row
  })
  const explanations = data.explanations?.map((row): ExplanationRecord => {
    const [key, rest] = splitExplanationKey(row.questionId)
    const r = rewrite(key)
    return r ? { ...row, questionId: `${r.key}${rest}` } : row
  })

  const cardIds = new Map<string, { id: string; examId: string }>()
  const reviewCards = data.reviewCards?.map((card): ReviewCard => {
    const first = card.questionKeys[0]
    if (first) studied(first)
    const rewrites = card.questionKeys.map(rewrite)
    if (rewrites.every((r) => !r)) return card
    // A card is archived whole if any of its questions retired.
    const archived = rewrites.some((r) => r?.archived)
    const examId = archived ? archivedExamId(card.examId, revision.id) : card.examId
    const keys = card.questionKeys.map((key, index) => (archived
      ? `${examId}${key.slice(key.indexOf(QUESTION_KEY_SEPARATOR))}`
      : rewrites[index]?.key ?? key))
    const remap = (value: string) => (value === `${CARD_PREFIX}${card.questionKeys[0]}` ? `${CARD_PREFIX}${keys[0]}` : value)
    const next = { ...card, id: remap(card.id), atomId: remap(card.atomId), examId, questionKeys: keys }
    cardIds.set(card.id, { id: next.id, examId })
    rewrites.forEach((r, index) => { if (r) note(archived ? { ...r, archived: true } : r, card.questionKeys[index]) })
    return next
  })
  const reviewLogs = data.reviewLogs?.map((log): ReviewLog => {
    const card = cardIds.get(log.cardId)
    return card ? { ...log, cardId: card.id, examId: card.examId } : log
  })

  return {
    data: { ...data, progress, attempts, explanations, reviewCards, reviewLogs, local: { ...(data.local ?? {}), [BANK_REVISION_KEY]: revision.id } } as BackupData,
    impact,
  }
}

/**
 * Revision ids after `applied`, in order. No marker means the data predates
 * every revision, so all apply. A marker this build doesn't know comes from a
 * newer build — its data is already ahead, so nothing applies.
 */
export function pendingRevisionIds(order: string[], applied: string | null | undefined): string[] {
  if (!applied) return [...order]
  const at = order.indexOf(applied)
  return at === -1 ? [] : order.slice(at + 1)
}
