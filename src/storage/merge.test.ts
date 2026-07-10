import { describe, expect, it } from 'vitest'
import { mergeData, SYNC_LOCAL_KEYS, type BackupData } from './merge'
import { createProgress } from '../domain/studyEngine'
import { createQuestionCard, gradeCard } from '../domain/reviewScheduler'
import type { AttemptRecord } from './db'

function attempt(questionId: string, answeredAt: string, correct = true): AttemptRecord {
  return { questionId, selected: [1], correct, guessed: false, elapsedMs: 1000, answeredAt, mode: 'adaptive' }
}

function empty(): BackupData {
  return { progress: [], attempts: [], results: [], explanations: [], local: {} }
}

describe('mergeData', () => {
  it('returns local unchanged when there is no remote', () => {
    const local = { ...empty(), attempts: [attempt('A', '2026-01-01T00:00:00Z')] }
    expect(mergeData(local, null)).toBe(local)
  })

  it('unions attempts and dedupes by question+timestamp', () => {
    const a = attempt('A', '2026-01-01T00:00:00Z')
    const local = { ...empty(), attempts: [a, attempt('A', '2026-01-02T00:00:00Z')] }
    const remote = { ...empty(), attempts: [a, attempt('A', '2026-01-03T00:00:00Z')] }
    const merged = mergeData(local, remote)
    expect(merged.attempts).toHaveLength(3) // shared one collapses
  })

  it('recomputes progress by replaying attempts from both devices in order', () => {
    const local = { ...empty(), attempts: [attempt('A', '2026-01-01T00:00:00Z')], progress: [{ ...createProgress('A'), attempts: 1, correct: 1, streak: 1 }] }
    const remote = { ...empty(), attempts: [attempt('A', '2026-01-02T00:00:00Z')], progress: [{ ...createProgress('A'), attempts: 1, correct: 1, streak: 1 }] }
    const merged = mergeData(local, remote)
    const a = merged.progress.find((p) => p.questionId === 'A')!
    expect(a.attempts).toBe(2) // not 1 — both devices' attempts combine
    expect(a.streak).toBe(2)
  })

  it('keeps bookmark-only questions that have no attempts', () => {
    const local = { ...empty(), progress: [{ ...createProgress('B'), bookmarked: true }] }
    const merged = mergeData(local, empty())
    const b = merged.progress.find((p) => p.questionId === 'B')
    expect(b?.bookmarked).toBe(true)
  })

  it('unions completed results by sessionId without duplicating', () => {
    const r = { sessionId: 's1', mode: 'mock', title: 'm', finishedAt: '2026-01-01T00:00:00Z', answered: 80, correct: 60, score: 60, maxScore: 100, passed: true, durationMs: 1000 }
    const merged = mergeData({ ...empty(), results: [r] }, { ...empty(), results: [r] })
    expect(merged.results).toHaveLength(1)
  })

  it('never syncs the live session key', () => {
    expect(SYNC_LOCAL_KEYS).not.toContain('level-b-active-session')
  })

  it('merges review cards by id, most recently updated wins', () => {
    const question = { id: '17300-01-001', prompt: 'p', options: ['a', 'b', 'c', 'd'], answers: [1] }
    const fresh = createQuestionCard('web-design-b', question, new Date('2026-01-01T00:00:00Z'))
    // Same deterministic id on both devices; the remote copy was graded later.
    const graded = gradeCard(fresh, 'good', new Date('2026-01-02T00:00:00Z')).card
    const merged = mergeData({ ...empty(), reviewCards: [fresh] }, { ...empty(), reviewCards: [graded] })
    expect(merged.reviewCards).toHaveLength(1)
    expect(merged.reviewCards![0].reps).toBe(1) // graded copy won
    expect(merged.reviewCards![0].state).toBe('review')
  })

  it('unions review logs by id and tolerates pre-v4 snapshots without the fields', () => {
    const log = { id: 'log-1', profileId: 'local', cardId: 'c1', examId: 'web-design-b', rating: 'good' as const, reviewedAt: '2026-01-01T00:00:00Z', elapsedMs: 0, previousDueAt: '2026-01-01T00:00:00Z', nextDueAt: '2026-01-02T00:00:00Z' }
    const oldSnapshot = empty()
    delete (oldSnapshot as Partial<BackupData>).reviewCards
    delete (oldSnapshot as Partial<BackupData>).reviewLogs
    const merged = mergeData({ ...empty(), reviewLogs: [log, { ...log }] }, oldSnapshot)
    expect(merged.reviewLogs).toHaveLength(1)
    expect(merged.reviewCards).toEqual([])
  })
})
