import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './components/Dashboard'
import { LibraryView } from './components/LibraryView'
import { GlossaryView } from './components/GlossaryView'
import { PracticeView } from './components/PracticeView'
import { StatsView } from './components/StatsView'
import {
  applyAttempt,
  buildAdaptiveQueue,
  buildFreshQueue,
  buildHighYieldQueue,
  buildMockQueue,
  buildRandomQueue,
  buildSprintQueue,
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
const EXPLAIN_VERSION = 'v12'

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
    adaptive: 'Due review 10',
    random: 'Random 10',
    fresh: 'Fresh sprint',
    highYield: 'Mini mock 20',
    wrong: 'Wrong answers',
    flashcard: 'Recall cards',
    commute: 'Commute notes',
    mock: 'Official mock',
    sprint: 'Exam sprint',
    item: 'Item review',
  }[mode]
}

function shuffleOptions(question: Question): number[] {
  const order = question.options.map((_, index) => index + 1)
  // Image-option questions refer to numbered figures in the source image; keep
  // those stable until each image is rendered directly inside its option card.
  if (question.options.some((option) => option.includes('圖示選項'))) return order
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[target]] = [order[target], order[index]]
  }
  return order
}

function createSession(mode: SessionMode, questions: Question[], title?: string, options: { mockFeedback?: boolean } = {}): StudySession {
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
    optionOrders: Object.fromEntries(questions.map((question) => [question.id, shuffleOptions(question)])),
    flags: {},
    mockFeedback: options.mockFeedback,
    mockEndsAt: mode === 'mock' ? new Date(now.getTime() + MOCK_DURATION_MS).toISOString() : undefined,
    mockRemainingMs: mode === 'mock' ? MOCK_DURATION_MS : undefined,
  }
}

async function explainQuestion(question: Question, selected: number[], style = 'default') {
  // Bump EXPLAIN_VERSION whenever the prompt changes so old cached answers regenerate.
  const selectedKey = style === 'reading' ? 'reading' : [...selected].sort((a, b) => a - b).join(',')
  const optionKey = question.options.join('¦')
  const cacheKey = `${question.id}::${style}::${selectedKey}::${optionKey}::${EXPLAIN_VERSION}`
  const cached = await db.explanations.get(cacheKey)
  if (cached?.content.trim()) return cached.content
  if (cached) await db.explanations.delete(cacheKey)
  const token = localStorage.getItem('level-b-ai-access-token')
  if (!token) throw new Error('AI is ready to connect after you choose Claude or OpenAI and add a private access token.')
  // Reading mode is pre-answer translation help: never send the answer key or selection.
  const isReading = style === 'reading'
  const payloadQuestion = isReading ? { ...question, answers: [] } : question
  const response = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: payloadQuestion, selected: isReading ? [] : selected, provider: localStorage.getItem('level-b-ai-provider') ?? undefined, style: style === 'default' ? undefined : style }),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error ?? 'The AI explanation service is not available yet.')
  }
  const data = await response.json() as { explanation: string; provider?: string }
  if (!data.explanation.trim()) throw new Error('AI returned an empty explanation. Please regenerate this note.')
  await db.explanations.put({ questionId: cacheKey, content: data.explanation, provider: data.provider ?? 'ai', updatedAt: new Date().toISOString() })
  return data.explanation
}

export default function App() {
  const { bank, error } = useQuestionBank()
  const { progress, setProgress, loading, refresh } = useStudyData()
  const [tab, setTab] = useState<Tab>('study')
  const [session, setSession] = useState<StudySession | null>(() => loadSession())
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [summary, setSummary] = useState<StudySession | null>(null)
  const prefetchedCueSessionRef = useRef('')

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])

  // Pull the cloud copy on open and merge it in (no-op if sync is off or fails).
  useEffect(() => {
    if (!isSyncEnabled()) return
    void syncNow().then(() => refresh()).catch(() => undefined)
  }, [refresh])

  // Stats count active questions only, so deleted items never inflate the UI.
  const stats = (bank?.questions ?? []).reduce((acc, question) => {
    const item = progress[question.id]
    if (!item) return acc
    acc.attempts += item.attempts
    acc.correct += item.correct
    if (item.attempts > 0) acc.seen += 1
    if (item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= Date.now()) acc.due += 1
    if (item.wrong > 0 && item.streak < 2) acc.wrong += 1
    return acc
  }, { attempts: 0, correct: 0, seen: 0, due: 0, wrong: 0 })
  const seen = stats.seen
  const attempts = stats.attempts
  const accuracy = attempts ? Math.round((stats.correct / attempts) * 100) : 0
  const due = stats.due
  const wrongCount = stats.wrong

  const sessionQuestions = useMemo(() => {
    if (!session || !bank) return []
    return session.questionIds.map((id) => bank.byId.get(id)).filter((question): question is Question => !!question)
  }, [bank, session])

  useEffect(() => {
    if (!session || !['flashcard', 'commute'].includes(session.mode) || !sessionQuestions.length) return
    if (!localStorage.getItem('level-b-ai-access-token')) return
    if (prefetchedCueSessionRef.current === session.id) return
    prefetchedCueSessionRef.current = session.id

    let cancelled = false
    void (async () => {
      for (const question of sessionQuestions) {
        if (cancelled) return
        const selected = session.mode === 'commute' ? (progress[question.id]?.lastSelected ?? []) : []
        await explainQuestion(question, selected, session.mode === 'commute' ? 'commute' : 'cue').catch(() => undefined)
      }
    })()

    return () => { cancelled = true }
  }, [progress, session, sessionQuestions])

  if (error) return <div className="fatal-state"><AlertTriangle /><h1>Question bank unavailable</h1><p>{error}</p></div>
  if (!bank || loading) return <div className="loading-state"><LoaderCircle className="spin" /><strong>Opening your study bank</strong><span>Loading the syllabus…</span></div>

  const begin = (mode: SessionMode, questions: Question[], title?: string, options?: { mockFeedback?: boolean }) => {
    if (!questions.length) return
    setSummary(null)
    setSession(createSession(mode, questions, title, options))
    setPracticeOpen(true)
  }

  const startMock = (mockFeedback = false) => {
    try {
      begin('mock', buildMockQueue(bank.questions), mockFeedback ? 'Training mock' : 'Official mock', { mockFeedback })
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

  const startCommuteNotes = () => {
    const wrong = bank.questions
      .filter((question) => progress[question.id]?.wrong > 0 && progress[question.id].streak < 2)
      .sort((left, right) => {
        const a = progress[left.id]
        const b = progress[right.id]
        if ((a?.wrong ?? 0) !== (b?.wrong ?? 0)) return (b?.wrong ?? 0) - (a?.wrong ?? 0)
        return (b?.lastAnsweredAt ?? '').localeCompare(a?.lastAnsweredAt ?? '')
      })
    if (!wrong.length) {
      window.alert('No active wrong answers yet. Missed items will appear here after practice or mocks.')
      return
    }
    begin('commute', wrong, `Commute notes · ${wrong.length} wrong`)
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

  const toggleFlag = (questionId: string) => updateSession((current) => ({
    ...current,
    flags: { ...(current.flags ?? {}), [questionId]: !(current.flags?.[questionId]) },
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
    if (session.mode === 'commute') {
      setSession(null)
      setPracticeOpen(false)
      return
    }

    // Score any option that is selected but never submitted (e.g. the question on
    // screen when a mock's timer runs out), and persist it as an attempt.
    const finalAnswers = { ...session.answers }
    const pending = session.questionIds
      .map((id) => ({ id, question: bank.byId.get(id), selected: session.selections[id] }))
      .filter((entry) => entry.question && !finalAnswers[entry.id] && entry.selected?.length)
    if (pending.length) {
      const answeredAt = new Date()
      const updates = pending.map((entry) => {
        const correct = scoreAnswer(entry.question!, entry.selected!)
        finalAnswers[entry.id] = { selected: entry.selected!, correct, guessed: false }
        const next = applyAttempt(progress[entry.id] ?? createProgress(entry.id), { selected: entry.selected!, correct, guessed: false, elapsedMs: 0, answeredAt })
        return { id: entry.id, correct, selected: entry.selected!, next }
      })
      await db.transaction('rw', db.progress, db.attempts, async () => {
        for (const u of updates) {
          await db.progress.put(u.next)
          await db.attempts.add({ questionId: u.id, selected: u.selected, correct: u.correct, guessed: false, elapsedMs: 0, answeredAt: answeredAt.toISOString(), mode: session.mode })
        }
      })
      setProgress((current) => {
        const next = { ...current }
        for (const u of updates) next[u.id] = u.next
        return next
      })
    }

    if (session.mode !== 'item') {
      const answers = Object.values(finalAnswers)
      const correct = answers.filter((answer) => answer.correct).length
      const isMock = session.mode === 'mock'
      const score = isMock
        ? session.questionIds.reduce((total, id) => {
          const answer = finalAnswers[id]
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

    setSummary({ ...session, answers: finalAnswers, completed: true })
    setSession(null)
    setPracticeOpen(false)

    // Push this session up to the cloud (no-op if sync is off or offline).
    if (isSyncEnabled()) void syncNow().catch(() => undefined)
  }

  const explain = async (question: Question, selected: number[], style = 'default') => {
    return explainQuestion(question, selected, style)
  }

  if (practiceOpen && session && sessionQuestions.length) {
    return <PracticeView session={session} questions={bank.byId} progress={progress} onExit={pausePractice} onSelect={onSelect} onSubmit={recordAttempt} onFlashcardGrade={async (question, knewIt) => recordAttempt(question, [], false, knewIt)} onNavigate={navigate} onToggleBookmark={toggleBookmark} onToggleFlag={toggleFlag} onComplete={() => void complete()} onExplain={explain} />
  }

  if (summary) {
    const summarySession = summary
    const answers = Object.values(summarySession.answers)
    const isMock = summarySession.mode === 'mock'
    const mockScore = isMock ? summarySession.questionIds.reduce((score, id) => {
      const question = bank.byId.get(id)
      const answer = summarySession.answers[id]
      return score + (answer?.correct ? (question?.kind === 'multiple' ? 2 : 1) : 0)
    }, 0) : null
    const correct = answers.filter((answer) => answer.correct).length

    const groupBreakdown = isMock ? (() => {
      const map = new Map<string, { section: string; label: string; total: number; correct: number; missed: number }>()
      for (const id of summarySession.questionIds) {
        const question = bank.byId.get(id)
        if (!question) continue
        const group = map.get(question.section) ?? { section: question.section, label: question.sectionTitle ?? question.section, total: 0, correct: 0, missed: 0 }
        group.total += 1
        if (summarySession.answers[id]?.correct) group.correct += 1
        else group.missed += 1
        map.set(question.section, group)
      }
      return [...map.values()].sort((a, b) => a.correct / a.total - b.correct / b.total)
    })() : []
    const missed = isMock ? summarySession.questionIds.filter((id) => !summarySession.answers[id]?.correct).map((id) => bank.byId.get(id)).filter((q): q is Question => !!q) : []

    return (
      <main className="session-summary">
        <CheckCircle2 size={34} />
        <p className="eyebrow">Session recorded</p>
        <h1>{summarySession.title}</h1>
        <strong className="summary-score">{mockScore !== null ? `${mockScore}/100` : `${correct}/${answers.length}`}</strong>
        <p>{mockScore !== null ? (mockScore >= 60 ? 'Passing score in this mock.' : 'Not passing yet; the missed items are now in review.') : 'Every answer updated its item history and next review time.'}</p>

        {isMock ? (
          <div className="mock-breakdown">
            <div className="section-heading compact"><div><p className="eyebrow">Breakdown</p><h2>By work group</h2></div></div>
            <div className="breakdown-list">
              {groupBreakdown.map((group) => {
                const accuracyPct = Math.round((group.correct / group.total) * 100)
                return (
                  <div className={accuracyPct < 60 ? 'breakdown-row weak' : 'breakdown-row'} key={group.section}>
                    <div className="breakdown-head"><strong>{group.label}</strong><span>{group.correct}/{group.total}</span></div>
                    <div className="mini-track"><span style={{ width: `${accuracyPct}%` }} /></div>
                    {group.missed ? <button className="group-practice" onClick={() => begin('adaptive', buildAdaptiveQueue(bank.questions.filter((question) => question.section === group.section), progress, 10), `${group.label} · practice`)} type="button">Practice this group <ArrowRight size={15} /></button> : null}
                  </div>
                )
              })}
            </div>
            {missed.length ? (
              <button className="secondary-action wide" onClick={() => begin('wrong', missed, 'Review missed')} type="button"><RotateCcw size={16} /> Review {missed.length} missed</button>
            ) : null}
          </div>
        ) : null}

        <div className="summary-actions">
          <button className="primary-action" onClick={() => { setSummary(null); setTab('study') }} type="button">Back to study</button>
          <button className="secondary-action" onClick={() => begin(summarySession.mode, summarySession.questionIds.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q), summarySession.title, { mockFeedback: summarySession.mockFeedback })} type="button"><RotateCcw size={17} /> Repeat session</button>
        </div>
      </main>
    )
  }

  return (
    <div className="app-frame">
      {tab === 'study' ? <Dashboard seen={seen} total={bank.questions.length} due={due} wrongCount={wrongCount} accuracy={accuracy} hasSession={!!session} sessionLabel={session?.title} onContinue={resumePractice} onSequential={startSequential} onAdaptive={() => begin('adaptive', buildAdaptiveQueue(bank.questions, progress, 10))} onRandom={() => begin('random', buildRandomQueue(bank.questions, 10))} onFresh={(limit) => begin('fresh', buildFreshQueue(bank.questions, progress, limit), `Fresh ${limit}`)} onHighYield={() => begin('highYield', buildHighYieldQueue(bank.questions, progress, 20))} onSubject={(subjectCode, title) => begin('random', buildRandomQueue(bank.questions.filter((question) => question.subjectCode === subjectCode), 10), title)} onWrong={startWrong} onFlashcards={() => begin('flashcard', buildAdaptiveQueue(bank.questions, progress, 10), 'Recall cards · mind notes')} onCommuteNotes={startCommuteNotes} onMock={() => startMock(false)} onMockTraining={() => startMock(true)} onSprint={() => begin('sprint', buildSprintQueue(bank.questions, progress, 20))} /> : null}
      {tab === 'library' ? <LibraryView questions={bank.questions} progress={progress} onOpen={(question) => begin('item', [question])} /> : null}
      {tab === 'glossary' ? <GlossaryView onPracticeSection={(section, title) => begin('adaptive', buildAdaptiveQueue(bank.questions.filter((question) => question.section === section), progress, 10), title)} /> : null}
      {tab === 'stats' ? <StatsView questions={bank.questions} progress={progress} onSaveAiToken={(token) => localStorage.setItem('level-b-ai-access-token', token)} onPracticeGroup={(section, title) => begin('adaptive', buildAdaptiveQueue(bank.questions.filter((question) => question.section === section), progress, 10), `${title} · practice`)} /> : null}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
