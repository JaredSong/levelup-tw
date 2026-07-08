import { ArrowRight, CheckCircle2, CircleAlert, Download, FileWarning, Gauge, History, Moon, RefreshCw, RotateCcw, Shuffle, Sun, Target, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Progress, Question } from '../domain/studyEngine'
import { computeReadiness } from '../domain/readiness'
import { db, type AttemptRecord, type SessionResult } from '../storage/db'
import { exportBackup, importBackup } from '../storage/backup'
import { getSyncPass, setSyncPass, syncNow, syncStatusLabel } from '../storage/sync'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  onSaveAiToken: (token: string) => void
  onPracticeGroup: (section: string, title: string) => void
}

const STATUS_LABEL = { weak: 'Needs work', building: 'Building', ready: 'Ready' } as const
const OPTION_RANDOMIZE_KEY = 'level-b-randomize-options'
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

export function StatsView({ questions, progress, onSaveAiToken, onPracticeGroup }: Props) {
  const [results, setResults] = useState<SessionResult[]>([])
  const [attemptLog, setAttemptLog] = useState<AttemptRecord[]>([])
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('level-b-ai-provider') ?? 'openai')

  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const [randomizeOptions, setRandomizeOptions] = useState(() => localStorage.getItem(OPTION_RANDOMIZE_KEY) !== 'false')

  const chooseTheme = (value: 'light' | 'dark') => {
    setTheme(value)
    localStorage.setItem('level-b-theme', value)
    document.documentElement.dataset.theme = value
  }

  const chooseRandomizeOptions = (value: boolean) => {
    setRandomizeOptions(value)
    localStorage.setItem(OPTION_RANDOMIZE_KEY, value ? 'true' : 'false')
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { hadRemote } = await syncNow()
      setSyncMsg(hadRemote ? 'Synced with the cloud. Reloading…' : 'Uploaded. Use the same passphrase on your other device.')
      if (hadRemote) window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setSyncMsg(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  const chooseProvider = (value: string) => {
    setAiProvider(value)
    localStorage.setItem('level-b-ai-provider', value)
  }

  const download = (content: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    download(await exportBackup(), `level-up-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  const handleExportWrong = () => {
    const wrong = questions.filter((question) => (progress[question.id]?.wrong ?? 0) > 0)
    if (!wrong.length) {
      setDataMsg('No wrong questions recorded yet.')
      return
    }
    const blocks = wrong.map((question, index) => {
      const item = progress[question.id]
      const mastered = (item?.streak ?? 0) >= 2 ? ' [now mastered]' : ''
      const options = question.options
        .map((option, optionIndex) => `   ${question.answers.includes(optionIndex + 1) ? '✓' : ' '} ${optionIndex + 1}. ${option}`)
        .join('\n')
      return `${index + 1}. [${question.id}] ${question.sectionTitle ?? ''} · wrong ${item?.wrong ?? 0}×${mastered}\n${question.prompt}\n${options}`
    })
    const header = `Level Up — Wrong questions (${wrong.length})\nExported ${new Date().toLocaleString()}\n✓ marks the official answer.\n`
    download(`${header}\n${blocks.join('\n\n')}\n`, `level-up-wrong-${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain;charset=utf-8')
    setDataMsg(`Exported ${wrong.length} wrong questions.`)
  }

  const handleImport = async (file: File) => {
    try {
      await importBackup(await file.text())
      setDataMsg('Backup restored. Reloading…')
      window.setTimeout(() => window.location.reload(), 800)
    } catch (error) {
      setDataMsg(error instanceof Error ? error.message : 'Could not read that file.')
    }
  }

  useEffect(() => {
    void db.results.orderBy('finishedAt').reverse().toArray().then(setResults)
    void db.attempts.toArray().then(setAttemptLog)
  }, [])

  const readiness = useMemo(() => computeReadiness(questions, progress, attemptLog), [questions, progress, attemptLog])

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
    <main className="page stats-page">
      <header className="page-title">
        <p className="eyebrow">Evidence, not guilt</p>
        <h1>Your progress</h1>
        <p>First exposure and retained knowledge are shown separately.</p>
      </header>

      <section className="stat-grid">
        <div><Target size={20} /><span>Items seen</span><strong>{seenCount}</strong></div>
        <div><CheckCircle2 size={20} /><span>Accuracy</span><strong>{accuracy}%</strong></div>
        <div><RotateCcw size={20} /><span>Total attempts</span><strong>{attempts}</strong></div>
        <div><CircleAlert size={20} /><span>Weak items</span><strong>{wrongItems}</strong></div>
      </section>

      <section className="appearance">
        <h2>Appearance</h2>
        <p>Choose a light or dark theme for the app.</p>
        <div className="theme-toggle" role="group" aria-label="Theme">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => chooseTheme('light')} type="button"><Sun size={16} /> Light</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => chooseTheme('dark')} type="button"><Moon size={16} /> Dark</button>
        </div>
      </section>

      <section className="appearance">
        <h2>Practice options</h2>
        <p>Choose whether new sessions shuffle answer choices or keep the official 1-4 order. Image-option questions always stay in official order.</p>
        <div className="theme-toggle" role="group" aria-label="Answer choice order">
          <button className={randomizeOptions ? 'active' : ''} onClick={() => chooseRandomizeOptions(true)} type="button"><Shuffle size={16} /> Random</button>
          <button className={!randomizeOptions ? 'active' : ''} onClick={() => chooseRandomizeOptions(false)} type="button"><RotateCcw size={16} /> Official order</button>
        </div>
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

      <section className="data-backup">
        <div>
          <p className="eyebrow">Your data</p>
          <h2>Backup &amp; restore</h2>
          <p>Progress, mock history and notes are saved in this browser only. Export a file to back up or move to another device.</p>
        </div>
        <div className="backup-actions">
          <button className="secondary-action" onClick={() => void handleExport()} type="button"><Download size={17} /> Export backup</button>
          <label className="secondary-action file-button">
            <Upload size={17} /> Import backup
            <input accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); event.target.value = '' }} type="file" />
          </label>
          <button className="secondary-action" onClick={handleExportWrong} type="button"><FileWarning size={17} /> Export wrong questions</button>
        </div>
        {dataMsg ? <p className="backup-msg">{dataMsg}</p> : null}
      </section>

      <section className="cloud-sync">
        <div>
          <p className="eyebrow">Cross-device</p>
          <h2>Cloud sync</h2>
          <p>Set the same passphrase on each device to keep progress, mock history and notes in sync. Runs automatically when the app opens and after each session. Works on the deployed site.</p>
          <p className={getSyncPass() ? 'sync-status ok' : 'sync-status warn'}>{syncStatusLabel()}</p>
        </div>
        <label>
          <span>Sync passphrase (min 8 characters)</span>
          <input defaultValue={getSyncPass()} onBlur={(event) => setSyncPass(event.target.value.trim())} placeholder="Not set" type="password" />
        </label>
        <button className="secondary-action" disabled={syncing} onClick={() => void handleSync()} type="button"><RefreshCw size={17} /> {syncing ? 'Syncing…' : 'Sync now'}</button>
        {syncMsg ? <p className="backup-msg">{syncMsg}</p> : null}
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
          <button className={aiProvider === 'gemini' ? 'active' : ''} onClick={() => chooseProvider('gemini')} type="button">Gemini</button>
        </div>
        <label>
          <span>Private app access token</span>
          <input defaultValue={localStorage.getItem('level-b-ai-access-token') ?? ''} onBlur={(event) => onSaveAiToken(event.target.value.trim())} placeholder="Not configured" type="password" />
        </label>
      </section>

      <section className="readiness-section">
        <div className="section-heading compact">
          <div><p className="eyebrow">Exam readiness</p><h2>By work group</h2></div>
          <span><Gauge size={15} /> {pct(readiness.overall)}% ready</span>
        </div>
        <div className="readiness-bar" aria-label={`${pct(readiness.overall)} percent ready`}><span style={{ width: `${pct(readiness.overall)}%` }} /></div>
        <p className="readiness-note">Weighted by the official mock mix. Recent accuracy uses your last 20 answers per group, so early mistakes don’t haunt you.</p>
        <div className="group-list">
          {readiness.groups.map((group) => (
            <div className={`group-row ${group.status}`} key={group.section}>
              <div className="group-top">
                <strong>{group.label}</strong>
                <span className="group-code">{group.subjectCode}</span>
                <span className={`status-badge ${group.status}`}>{STATUS_LABEL[group.status]}</span>
              </div>
              <div className="group-metrics">
                <span>Coverage <strong>{pct(group.coverage)}%</strong></span>
                <span>Recent <strong>{group.recentAccuracy == null ? '—' : `${pct(group.recentAccuracy)}%`}</strong>{group.recentCount ? <small> ({group.recentCount})</small> : null}</span>
                <span>Mastered <strong>{pct(group.mastery)}%</strong></span>
              </div>
              {group.status !== 'ready' ? (
                <button className="group-practice" onClick={() => onPracticeGroup(group.section, group.label)} type="button">Practice this group <ArrowRight size={15} /></button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <p className="build-version">Level Up · 升級吧 {__APP_VERSION__}</p>
    </main>
  )
}
