import { ArrowRight, CheckCircle2, CircleAlert, Flame, Gauge, History, ListChecks, RotateCcw, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useActiveExam } from '../app/useActiveExam'
import { QUESTION_KEY_SEPARATOR } from '../core/exam'
import type { ReviewCard } from '../core/contracts'
import type { Progress, Question } from '../domain/studyEngine'
import { computeReadiness } from '../domain/readiness'
import { reviewLoadSummary } from '../domain/reviewScheduler'
import { zhTW } from '../i18n/zh-TW'
import { db, type AttemptRecord, type SessionResult } from '../storage/db'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  reviewCards: ReviewCard[]
  streak: number
  onPracticeGroup: (section: string, title: string) => void
}

const STATUS_LABEL = { weak: zhTW.stats.statusWeak, building: zhTW.stats.statusBuilding, ready: zhTW.stats.statusReady } as const
const pct = (value: number) => Math.round(value * 100)

function formatWhen(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' · ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function MockTrend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const width = 100
  const height = 36
  const max = 100
  const step = width / (scores.length - 1)
  const y = (score: number) => height - (score / max) * height
  const points = scores.map((score, index) => `${index * step},${y(score)}`).join(' ')
  const passY = y(60)
  return (
    <svg className="mock-trend" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Mock score trend">
      <line x1="0" x2={width} y1={passY} y2={passY} className="trend-pass" />
      <polyline points={points} className="trend-line" fill="none" />
      {scores.map((score, index) => (
        <circle key={index} cx={index * step} cy={y(score)} r="1.6" className={score >= 60 ? 'trend-dot pass' : 'trend-dot'} />
      ))}
    </svg>
  )
}

// Insights behaves like a study coach, not a BI dashboard (docs/level-up-interface-spec.md):
// weak topics, review load, mock trend, and habit consistency — nothing about
// app settings lives here anymore (see SettingsView).
export function InsightsView({ questions, progress, reviewCards, streak, onPracticeGroup }: Props) {
  const { activeExam } = useActiveExam()
  const examId = activeExam.examId
  const [results, setResults] = useState<SessionResult[]>([])
  const [attemptLog, setAttemptLog] = useState<AttemptRecord[]>([])

  useEffect(() => {
    void db.results.orderBy('finishedAt').reverse().toArray().then(setResults)
    // Attempts store namespaced keys; readiness matches on bare question ids,
    // so keep this exam's rows and strip the prefix before computing.
    const prefix = `${examId}${QUESTION_KEY_SEPARATOR}`
    void db.attempts.where('questionId').startsWith(prefix).toArray().then((rows) => {
      setAttemptLog(rows.map((row) => ({ ...row, questionId: row.questionId.slice(prefix.length) })))
    })
  }, [examId])

  const readiness = useMemo(() => computeReadiness(questions, progress, attemptLog), [questions, progress, attemptLog])
  const load = useMemo(() => reviewLoadSummary(reviewCards, new Date()), [reviewCards])

  const mocks = results.filter((result) => result.mode === 'mock')
  const mockScoresChrono = [...mocks].reverse().map((result) => result.score)
  const bestMock = mocks.reduce((best, result) => Math.max(best, result.score), 0)

  // Active questions only (the questions prop already excludes deleted items).
  const rows = questions.map((question) => progress[question.id]).filter((item): item is Progress => !!item)
  const seenCount = rows.filter((item) => item.attempts > 0).length
  const attempts = rows.reduce((sum, item) => sum + item.attempts, 0)
  const correct = rows.reduce((sum, item) => sum + item.correct, 0)
  const wrongItems = rows.filter((item) => item.wrong > 0 && item.streak < 2).length
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0

  return (
    <main className="page insights-page">
      <header className="page-title">
        <p className="eyebrow">{zhTW.stats.eyebrow}</p>
        <h1>{zhTW.stats.title}</h1>
        <p>{zhTW.stats.description}</p>
      </header>

      <section className="stat-grid">
        <div><Target size={20} /><span>{zhTW.stats.itemsSeen}</span><strong>{seenCount}</strong></div>
        <div><CheckCircle2 size={20} /><span>{zhTW.stats.accuracy}</span><strong>{accuracy}%</strong></div>
        <div><RotateCcw size={20} /><span>{zhTW.stats.totalAttempts}</span><strong>{attempts}</strong></div>
        <div><CircleAlert size={20} /><span>{zhTW.stats.weakItems}</span><strong>{wrongItems}</strong></div>
      </section>

      <section className="insight-card">
        <div className="section-heading compact">
          <div><p className="eyebrow">{zhTW.stats.habitEyebrow}</p><h2>{zhTW.stats.habitTitle}</h2></div>
        </div>
        {streak > 0 ? (
          <p className="habit-streak-line"><Flame size={18} /> {zhTW.stats.habitStreak(streak)}</p>
        ) : (
          <p className="habit-streak-line muted"><Flame size={18} /> {zhTW.stats.habitNoStreak}</p>
        )}
      </section>

      <section className="insight-card">
        <div className="section-heading compact">
          <div><p className="eyebrow">{zhTW.stats.loadEyebrow}</p><h2>{zhTW.stats.loadTitle}</h2></div>
          <span><ListChecks size={15} /> {zhTW.stats.loadTotal(load.totalCards)}</span>
        </div>
        <div className="load-grid">
          <div className={load.overdueCount > 0 ? 'load-metric warn' : 'load-metric'}>
            <span>{zhTW.stats.loadOverdue}</span>
            <strong>{load.overdueCount}</strong>
          </div>
          <div className="load-metric">
            <span>{zhTW.stats.loadDueToday}</span>
            <strong>{load.dueTodayCount}</strong>
          </div>
        </div>
      </section>

      <section className="readiness-section">
        <div className="section-heading compact">
          <div><p className="eyebrow">{zhTW.stats.readinessEyebrow}</p><h2>{zhTW.stats.readinessTitle}</h2></div>
          <span><Gauge size={15} /> {zhTW.stats.readinessPct(pct(readiness.overall))}</span>
        </div>
        <div className="readiness-bar" aria-label={`${pct(readiness.overall)} percent ready`}><span style={{ width: `${pct(readiness.overall)}%` }} /></div>
        <p className="readiness-note">{zhTW.stats.readinessNote}</p>
        <div className="group-list">
          {readiness.groups.map((group) => (
            <div className={`group-row ${group.status}`} key={group.section}>
              <div className="group-top">
                <strong>{group.label}</strong>
                <span className="group-code">{group.subjectCode}</span>
                <span className={`status-badge ${group.status}`}>{STATUS_LABEL[group.status]}</span>
              </div>
              <div className="group-metrics">
                <span>{zhTW.stats.coverage} <strong>{pct(group.coverage)}%</strong></span>
                <span>{zhTW.stats.recent} <strong>{group.recentAccuracy == null ? '—' : `${pct(group.recentAccuracy)}%`}</strong>{group.recentCount ? <small> ({group.recentCount})</small> : null}</span>
                <span>{zhTW.stats.mastered} <strong>{pct(group.mastery)}%</strong></span>
              </div>
              {group.status !== 'ready' ? (
                <button className="group-practice" onClick={() => onPracticeGroup(group.section, group.label)} type="button">{zhTW.stats.practiceGroup} <ArrowRight size={15} /></button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mock-history">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">{zhTW.stats.mockHistoryEyebrow}</p>
            <h2>{zhTW.stats.mockHistoryTitle}</h2>
          </div>
          {mocks.length ? <span>{zhTW.stats.mockSummary(mocks.length, bestMock)}</span> : null}
        </div>
        {mocks.length ? (
          <>
            <MockTrend scores={mockScoresChrono} />
            <div className="history-list">
              {mocks.map((result) => (
                <div className={result.passed ? 'history-row pass' : 'history-row'} key={result.id}>
                  <span className="history-score">{result.score}<small>/{result.maxScore}</small></span>
                  <div>
                    <strong>{formatWhen(result.finishedAt)}</strong>
                    <small>{zhTW.stats.mockRow(result.answered, Math.round(result.durationMs / 60_000))}</small>
                  </div>
                  <span className={result.passed ? 'history-badge pass' : 'history-badge'}>{result.passed ? zhTW.stats.pass : zhTW.stats.below}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="history-empty"><History size={18} /> {zhTW.stats.mockEmpty}</p>
        )}
      </section>
    </main>
  )
}
