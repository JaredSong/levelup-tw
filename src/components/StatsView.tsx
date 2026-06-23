import { CheckCircle2, CircleAlert, History, RotateCcw, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Progress, Question } from '../domain/studyEngine'
import { db, type SessionResult } from '../storage/db'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  onSaveAiToken: (token: string) => void
}

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

export function StatsView({ questions, progress, onSaveAiToken }: Props) {
  const [results, setResults] = useState<SessionResult[]>([])
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('level-b-ai-provider') ?? 'anthropic')

  const chooseProvider = (value: string) => {
    setAiProvider(value)
    localStorage.setItem('level-b-ai-provider', value)
  }

  useEffect(() => {
    void db.results.orderBy('finishedAt').reverse().toArray().then(setResults)
  }, [])

  const mocks = results.filter((result) => result.mode === 'mock')
  const mockScoresChrono = [...mocks].reverse().map((result) => result.score)
  const bestMock = mocks.reduce((best, result) => Math.max(best, result.score), 0)

  const rows = Object.values(progress)
  const attempts = rows.reduce((sum, item) => sum + item.attempts, 0)
  const correct = rows.reduce((sum, item) => sum + item.correct, 0)
  const wrongItems = rows.filter((item) => item.wrong > 0 && item.streak < 2).length
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0
  const subjects = Array.from(new Map(questions.map((question) => [
    question.subjectCode ?? '17300',
    question.subjectTitle ?? '網頁設計',
  ])).entries())

  return (
    <main className="page stats-page">
      <header className="page-title">
        <p className="eyebrow">Evidence, not guilt</p>
        <h1>Your progress</h1>
        <p>First exposure and retained knowledge are shown separately.</p>
      </header>

      <section className="stat-grid">
        <div><Target size={20} /><span>Items seen</span><strong>{rows.filter((r) => r.attempts).length}</strong></div>
        <div><CheckCircle2 size={20} /><span>Accuracy</span><strong>{accuracy}%</strong></div>
        <div><RotateCcw size={20} /><span>Total attempts</span><strong>{attempts}</strong></div>
        <div><CircleAlert size={20} /><span>Weak items</span><strong>{wrongItems}</strong></div>
      </section>

      <section className="mock-history">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Mock history</p>
            <h2>Past attempts</h2>
          </div>
          {mocks.length ? <span>{mocks.length} taken · best {bestMock}/100</span> : null}
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
                    <small>{result.answered} answered · {Math.round(result.durationMs / 60_000)} min</small>
                  </div>
                  <span className={result.passed ? 'history-badge pass' : 'history-badge'}>{result.passed ? 'Pass' : 'Below 60'}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="history-empty"><History size={18} /> Finish a mock to start tracking your scores here.</p>
        )}
      </section>

      <section className="ai-settings">
        <div>
          <p className="eyebrow">Optional</p>
          <h2>AI explanations</h2>
          <p>Pick which model explains answered items. Provider keys stay on the server.</p>
        </div>
        <div className="provider-toggle" role="group" aria-label="AI provider">
          <button className={aiProvider === 'anthropic' ? 'active' : ''} onClick={() => chooseProvider('anthropic')} type="button">Claude</button>
          <button className={aiProvider === 'openai' ? 'active' : ''} onClick={() => chooseProvider('openai')} type="button">OpenAI</button>
        </div>
        <label>
          <span>Private app access token</span>
          <input defaultValue={localStorage.getItem('level-b-ai-access-token') ?? ''} onBlur={(event) => onSaveAiToken(event.target.value.trim())} placeholder="Not configured" type="password" />
        </label>
      </section>

      <section className="section-performance">
        <div className="section-heading compact"><div><p className="eyebrow">By section</p><h2>Coverage and recall</h2></div></div>
        {subjects.map(([subjectCode, subjectTitle]) => {
          const sectionQuestions = questions.filter((question) => question.subjectCode === subjectCode)
          const sectionRows = sectionQuestions.map((question) => progress[question.id]).filter(Boolean)
          const sectionAttempts = sectionRows.reduce((sum, item) => sum + item.attempts, 0)
          const sectionCorrect = sectionRows.reduce((sum, item) => sum + item.correct, 0)
          const coverage = Math.round((sectionRows.filter((item) => item.attempts).length / sectionQuestions.length) * 100)
          const sectionAccuracy = sectionAttempts ? Math.round((sectionCorrect / sectionAttempts) * 100) : 0
          return (
            <div className="performance-row" key={subjectCode}>
              <span className="performance-code">{subjectCode}</span>
              <div>
                <strong>{subjectTitle}</strong>
                <div className="mini-track"><span style={{ width: `${coverage}%` }} /></div>
              </div>
              <span><strong>{coverage}%</strong><small>{sectionAccuracy}% recall</small></span>
            </div>
          )
        })}
      </section>
    </main>
  )
}
