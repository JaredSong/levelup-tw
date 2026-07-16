import type { ReviewCard, ReviewLog } from '../core/contracts'
import { applyAttempt, createProgress, type Progress } from '../domain/studyEngine'
import type { AttemptRecord, ExplanationRecord, SessionResult } from './db'

export interface BackupData {
  progress: Progress[]
  attempts: AttemptRecord[]
  results: SessionResult[]
  explanations: ExplanationRecord[]
  /** Absent in backups exported before version 4. */
  reviewCards?: ReviewCard[]
  reviewLogs?: ReviewLog[]
  local: Record<string, string>
}

// Keys that are safe to carry between devices. The live session is intentionally
// NOT synced — pulling another device's stale session makes finished sessions
// reappear. Export/backup may still include it via its own key list.
export const SYNC_LOCAL_KEYS = ['level-b-ai-provider', 'level-up-content-revision:employment-service-b']

// Rebuild a question's progress by replaying every attempt in chronological
// order. This correctly combines history from both devices instead of picking
// one device's derived snapshot and discarding the other's.
function recomputeProgress(attempts: AttemptRecord[], snapshot?: Progress): Progress {
  const ordered = [...attempts].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
  let progress = createProgress(ordered[0]?.questionId ?? snapshot?.questionId ?? '')
  for (const a of ordered) {
    progress = applyAttempt(progress, {
      selected: a.selected,
      correct: a.correct,
      guessed: a.guessed,
      elapsedMs: a.elapsedMs,
      answeredAt: new Date(a.answeredAt),
    })
  }
  // Preserve device-agnostic, non-attempt fields from either snapshot.
  return {
    ...progress,
    bookmarked: !!snapshot?.bookmarked,
    note: snapshot?.note || progress.note,
  }
}

// Merge two snapshots without losing data from either side. Attempts/results are
// unioned by natural key; progress is recomputed from the merged attempts.
export function mergeData(local: BackupData, remote: BackupData | null): BackupData {
  if (!remote) return local

  const attempts = new Map<string, AttemptRecord>()
  for (const a of [...(remote.attempts ?? []), ...(local.attempts ?? [])]) {
    attempts.set(`${a.questionId}|${a.answeredAt}`, a)
  }

  const results = new Map<string, SessionResult>()
  for (const r of [...(remote.results ?? []), ...(local.results ?? [])]) {
    results.set(r.sessionId, r)
  }

  // Snapshots carry bookmark/note (and bookmark-only questions with no attempts).
  const snapshots = new Map<string, Progress>()
  for (const p of [...(remote.progress ?? []), ...(local.progress ?? [])]) {
    const existing = snapshots.get(p.questionId)
    snapshots.set(p.questionId, {
      ...(existing ?? p),
      ...p,
      bookmarked: !!(existing?.bookmarked || p.bookmarked),
      note: p.note || existing?.note || '',
    })
  }

  const attemptsByQuestion = new Map<string, AttemptRecord[]>()
  for (const a of attempts.values()) {
    const list = attemptsByQuestion.get(a.questionId) ?? []
    list.push(a)
    attemptsByQuestion.set(a.questionId, list)
  }

  const progress = new Map<string, Progress>()
  for (const [questionId, list] of attemptsByQuestion) {
    progress.set(questionId, recomputeProgress(list, snapshots.get(questionId)))
  }
  // Questions with a snapshot but no attempts (e.g. bookmarked only) survive.
  for (const [questionId, snapshot] of snapshots) {
    if (!progress.has(questionId)) progress.set(questionId, snapshot)
  }

  const local2: Record<string, string> = { ...(remote.local ?? {}), ...(local.local ?? {}) }

  return {
    progress: [...progress.values()],
    attempts: [...attempts.values()],
    results: [...results.values()],
    explanations: mergeExplanations(local, remote),
    reviewCards: mergeReviewCards(local, remote),
    reviewLogs: mergeReviewLogs(local, remote),
    local: local2,
  }
}

// Card ids are deterministic per question, so two devices adding the same
// question collide on id; the most recently graded copy carries the freshest
// scheduling state and wins.
function mergeReviewCards(local: BackupData, remote: BackupData): ReviewCard[] {
  const cards = new Map<string, ReviewCard>()
  for (const card of [...(remote.reviewCards ?? []), ...(local.reviewCards ?? [])]) {
    const existing = cards.get(card.id)
    if (!existing || new Date(card.updatedAt) >= new Date(existing.updatedAt)) cards.set(card.id, card)
  }
  return [...cards.values()]
}

function mergeReviewLogs(local: BackupData, remote: BackupData): ReviewLog[] {
  const logs = new Map<string, ReviewLog>()
  for (const log of [...(remote.reviewLogs ?? []), ...(local.reviewLogs ?? [])]) {
    logs.set(log.id, log)
  }
  return [...logs.values()]
}

function mergeExplanations(local: BackupData, remote: BackupData): ExplanationRecord[] {
  const explanations = new Map<string, ExplanationRecord>()
  for (const e of [...(remote.explanations ?? []), ...(local.explanations ?? [])]) {
    const existing = explanations.get(e.questionId)
    if (!existing || new Date(e.updatedAt) >= new Date(existing.updatedAt)) explanations.set(e.questionId, e)
  }
  return [...explanations.values()]
}
