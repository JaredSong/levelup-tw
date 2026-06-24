import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './components/Dashboard'
import { LibraryView } from './components/LibraryView'
import { PracticeView } from './components/PracticeView'
import { StatsView } from './components/StatsView'
import {
  applyAttempt,
  buildAdaptiveQueue,
  buildMockQueue,
  buildRandomQueue,
  createProgress,
  scoreAnswer,
  type Question,
} from './domain/studyEngine'
import { useQuestionBank } from './hooks/useQuestionBank'
import { useStudyData } from './hooks/useStudyData'
import { db } from './storage/db'
import { isSyncEnabled, syncNow } from './storage/sync'
import type { SessionMode, StudySession } from './types'

const SESSION_KEY = 'level-b-active-session'
const SEQUENTIAL_KEY = 'level-b-sequential-index'
const PERSONAL_START_INDEX = 144
const MOCK_DURATION_MS = 100 * 60_000
const EXPLAIN_VERSION = 'v2'

function loadSession(): StudySession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) as StudySession : null
  } catch {
    return null
  }
}

function titleForMode(mode: SessionMode) {
  return {
    sequential: 'New questions',
    adaptive: 'Adaptive 10',
    random: 'Random 10',
    wrong: 'Wrong answers',
    flashcard: 'Recall cards',
    mock: 'Official mock',
    item: 'Item review',
  }[mode]
}

function createSession(mode: SessionMode, questions: Question[], title?: string): StudySession {
  const now = new Date()
  return {
    id: crypto.randomUUID(),
    mode,
    title: title ?? titleForMode(mode),
    questionIds: questions.map((question) => question.id),
    currentIndex: 0,
    startedAt: now.toISOString(),
    questionStartedAt: now.toISOString(),
    answers: {},
    selections: {},
    mockEndsAt: mode === 'mock' ? new Date(now.getTime() + MOCK_DURATION_MS).toISOString() : undefined,
    mockRemainingMs: mode === 'mock' ? MOCK_DURATION_MS : undefined,
  }
}

export default function App() {
  const { bank, error } = useQuestionBank()
  const { progress, setProgress, loading, refresh } = useStudyData()
  const [tab, setTab] = useState<Tab>('study')
  const [session, setSession] = useState<StudySession | null>(() => loadSession())
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [summary, setSummary] = useState<StudySession | null>(null)

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])

  // Pull the cloud copy on open and merge it in (no-op if sync is off or fails).
  useEffect(() => {
    if (!isSyncEnabled()) return
    void syncNow().then(() => refresh()).catch(() => undefined)
  }, [refresh])

  const rows = Object.values(progress)
  const seen = rows.filter((item) => item.attempts > 0).length
  const attempts = rows.reduce((sum, item) => sum + item.attempts, 0)
  const accuracy = attempts ? Math.round((rows.reduce((sum, item) => sum + item.correct, 0) / attempts) * 100) : 0
  const due = rows.filter((item) => item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= Date.now()).length

  const sessionQuestions = useMemo(() => {
    if (!session || !bank) return []
    return session.questionIds.map((id) => bank.byId.get(id)).filter((question): question is Question => !!question)
  }, [bank, session])

  if (error) return <div className="fatal-state"><AlertTriangle /><h1>Question bank unavailable</h1><p>{error}</p></div>
  if (!bank || loading) return <div className="loading-state"><LoaderCircle className="spin" /><strong>Opening your study bank</strong><span>Loading 1,365 syllabus items…</span></div>

  const begin = (mode: SessionMode, questions: Question[], title?: string) => {
    if (!questions.length) return
    setSummary(null)
    setSession(createSession(mode, questions, title))
    setPracticeOpen(true)
  }

  const startMock = () => {
    try {
      begin('mock', buildMockQueue(bank.questions))
    } catch {
      window.alert('The question bank cannot currently satisfy the official mock format.')
    }
  }

  // Pause: freeze the mock clock so paused time is not counted against the exam timer.
  const pausePractice = () => {
    updateSession((current) => {
      if (current.mode === 'mock' && current.mockEndsAt) {
        const remaining = Math.max(0, new Date(current.mockEndsAt).getTime() - Date.now())
        return { ...current, mockRemainingMs: remaining, mockEndsAt: undefined }
      }
      return current
    })
    setPracticeOpen(false)
  }

  // Resume: rebuild the absolute end time from the frozen remaining time.
  const resumePractice = () => {
    updateSession((current) => {
      if (current.mode === 'mock' && !current.mockEndsAt) {
        const remaining = current.mockRemainingMs ?? MOCK_DURATION_MS
        return { ...current, mockEndsAt: new Date(Date.now() + remaining).toISOString() }
      }
      return current
    })
    setPracticeOpen(true)
  }

  const startSequential = () => {
    const saved = Number(localStorage.getItem(SEQUENTIAL_KEY) ?? PERSONAL_START_INDEX)
    begin('sequential', bank.questions.slice(Math.min(saved, bank.questions.length - 1), saved + 20))
  }

  const startWrong = () => {
    const wrong = bank.questions.filter((question) => progress[question.id]?.wrong > 0 && progress[question.id].streak < 2)
    begin('wrong', wrong.length ? wrong : bank.questions.slice(0, PERSONAL_START_INDEX))
  }

  const updateSession = (updater: (current: StudySession) => StudySession) => {
    setSession((current) => current ? updater(current) : current)
  }

  const onSelect = (questionId: string, selected: number[]) => updateSession((current) => ({
    ...current,
    selections: { ...current.selections, [questionId]: selected },
  }))

  const recordAttempt = async (question: Question, selected: number[], guessed: boolean, forcedCorrect?: boolean) => {
    if (!session || session.answers[question.id]) return
    const correct = forcedCorrect ?? scoreAnswer(question, selected)
    const answeredAt = new Date()
    const elapsedMs = answeredAt.getTime() - new Date(session.questionStartedAt).getTime()
    const nextProgress = applyAttempt(progress[question.id] ?? createProgress(question.id), {
      selected,
      correct,
      guessed,
      elapsedMs,
      answeredAt,
    })

    await db.transaction('rw', db.progress, db.attempts, async () => {
      await db.progress.put(nextProgress)
      await db.attempts.add({ questionId: question.id, selected, correct, guessed, elapsedMs, answeredAt: answeredAt.toISOString(), mode: session.mode })
    })
    setProgress((current) => ({ ...current, [question.id]: nextProgress }))
    updateSession((current) => ({
      ...current,
      answers: { ...current.answers, [question.id]: { selected, correct, guessed } },
    }))
  }

  const navigate = (index: number) => updateSession((current) => ({
    ...current,
    currentIndex: Math.max(0, Math.min(index, current.questionIds.length - 1)),
    questionStartedAt: new Date().toISOString(),
  }))

  const toggleBookmark = async (questionId: string) => {
    const next = { ...(progress[questionId] ?? createProgress(questionId)), bookmarked: !(progress[questionId]?.bookmarked ?? false) }
    await db.progress.put(next)
    setProgress((current) => ({ ...current, [questionId]: next }))
  }

  const complete = async () => {
    if (!session) return
    if (session.mode === 'sequential') {
      const lastId = session.questionIds.at(-1)
      const lastIndex = bank.questions.findIndex((question) => question.id === lastId)
      if (lastIndex >= 0) localStorage.setItem(SEQUENTIAL_KEY, String(lastIndex + 1))
    }

    if (session.mode !== 'item') {
      const answers = Object.values(session.answers)
      const correct = answers.filter((answer) => answer.correct).length
      const isMock = session.mode === 'mock'
      const score = isMock
        ? session.questionIds.reduce((total, id) => {
          const answer = session.answers[id]
          return total + (answer?.correct ? (bank.byId.get(id)?.kind === 'multiple' ? 2 : 1) : 0)
        }, 0)
        : correct
      const maxScore = isMock ? 100 : answers.length
      await db.results.add({
        sessionId: session.id,
        mode: session.mode,
        title: session.title,
        finishedAt: new Date().toISOString(),
        answered: answers.length,
        correct,
        score,
        maxScore,
        passed: isMock ? score >= 60 : maxScore > 0 && correct / maxScore >= 0.6,
        durationMs: Date.now() - new Date(session.startedAt).getTime(),
      })
    }

    setSummary({ ...session, completed: true })
    setSession(null)
    setPracticeOpen(false)

    // Push this session up to the cloud (no-op if sync is off or offline).
    if (isSyncEnabled()) void syncNow().catch(() => undefined)
  }

  const explain = async (question: Question, selected: number[], style = 'default') => {
    // Bump EXPLAIN_VERSION whenever the prompt changes so old cached answers regenerate.
    const cacheKey = `${question.id}::${style}::${EXPLAIN_VERSION}`
    const cached = await db.explanations.get(cacheKey)
    if (cached) return cached.content
    const token = localStorage.getItem('level-b-ai-access-token')
    if (!token) throw new Error('AI is ready to connect after you choose Claude or OpenAI and add a private access token.')
    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, selected, provider: localStorage.getItem('level-b-ai-provider') ?? undefined, style: style === 'default' ? undefined : style }),
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(detail?.error ?? 'The AI explanation service is not available yet.')
    }
    const data = await response.json() as { explanation: string; provider?: string }
    await db.explanations.put({ questionId: cacheKey, content: data.explanation, provider: data.provider ?? 'ai', updatedAt: new Date().toISOString() })
    return data.explanation
  }

  if (practiceOpen && session && sessionQuestions.length) {
    return <PracticeView session={session} questions={bank.byId} progress={progress} onExit={pausePractice} onSelect={onSelect} onSubmit={recordAttempt} onFlashcardGrade={async (question, knewIt) => recordAttempt(question, [], false, knewIt)} onNavigate={navigate} onToggleBookmark={toggleBookmark} onComplete={() => void complete()} onExplain={explain} />
  }

  if (summary) {
    const answers = Object.values(summary.answers)
    const mockScore = summary.mode === 'mock' ? summary.questionIds.reduce((score, id) => {
      const question = bank.byId.get(id)
      const answer = summary.answers[id]
      return score + (answer?.correct ? (question?.kind === 'multiple' ? 2 : 1) : 0)
    }, 0) : null
    const correct = answers.filter((answer) => answer.correct).length
    return (
      <main className="session-summary">
        <CheckCircle2 size={34} />
        <p className="eyebrow">Session recorded</p>
        <h1>{summary.title}</h1>
        <strong className="summary-score">{mockScore !== null ? `${mockScore}/100` : `${correct}/${answers.length}`}</strong>
        <p>{mockScore !== null ? (mockScore >= 60 ? 'Passing score in this mock.' : 'Not passing yet; the missed items are now in review.') : 'Every answer updated its item history and next review time.'}</p>
        <button className="primary-action" onClick={() => { setSummary(null); setTab('study') }} type="button">Back to study</button>
        <button className="secondary-action" onClick={() => begin(summary.mode, summary.questionIds.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q))} type="button"><RotateCcw size={17} /> Repeat session</button>
      </main>
    )
  }

  return (
    <div className="app-frame">
      {tab === 'study' ? <Dashboard seen={seen} total={bank.questions.length} due={due} accuracy={accuracy} hasSession={!!session} sessionLabel={session?.title} onContinue={resumePractice} onSequential={startSequential} onAdaptive={() => begin('adaptive', buildAdaptiveQueue(bank.questions, progress, 10))} onRandom={() => begin('random', buildRandomQueue(bank.questions, 10))} onSubject={(subjectCode, title) => begin('random', buildRandomQueue(bank.questions.filter((question) => question.subjectCode === subjectCode), 10), title)} onWrong={startWrong} onFlashcards={() => begin('flashcard', buildAdaptiveQueue(bank.questions, progress, 10))} onMock={startMock} /> : null}
      {tab === 'library' ? <LibraryView questions={bank.questions} progress={progress} onOpen={(question) => begin('item', [question])} /> : null}
      {tab === 'stats' ? <StatsView questions={bank.questions} progress={progress} onSaveAiToken={(token) => localStorage.setItem('level-b-ai-access-token', token)} /> : null}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
