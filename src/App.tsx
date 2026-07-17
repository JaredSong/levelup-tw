import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { ActiveExamHeader } from './app/ActiveExamHeader'
import { trackEnterApp, trackInitialView, trackLanding } from './app/analytics'
import { LandingPage } from './app/LandingPage'
import { ExamPage } from './app/ExamPage'
import { GuidePage } from './app/GuidePage'
import { enLanding } from './i18n/en'
import { OnboardingGate } from './app/OnboardingGate'
import { hasCompletedOnboarding, PROFILE_NAME_KEY, shouldShowLanding } from './app/onboardingState'
import { readSyncLink } from './app/syncCode'
import { BottomNav, type Tab } from './components/BottomNav'
import { PracticeView } from './components/PracticeView'
import { HomePage } from './app/pages/HomePage'
import { InsightsPage } from './app/pages/InsightsPage'
import { MockExamPage } from './app/pages/MockExamPage'
import { PracticePage } from './app/pages/PracticePage'
import { ReviewPage } from './app/pages/ReviewPage'
import {
  applyAttempt,
  buildAdaptiveQueue,
  buildFreshQueue,
  buildHighYieldQueue,
  buildMockQueue,
  buildOptionOrder,
  buildRandomQueue,
  buildSprintQueue,
  createProgress,
  scoreAnswer,
  type Question,
} from './domain/studyEngine'
import { useActiveExam } from './app/useActiveExam'
import type { ReviewCard, ReviewRating } from './core/contracts'
import { mockDurationMilliseconds, parseQuestionKey, questionKey } from './core/exam'
import { buildDailyMission, studyStreak } from './domain/dailyMission'
import { buildDueCardQueue, createQuestionCard, gradeCard, questionCardId } from './domain/reviewScheduler'
import { useQuestionBank } from './hooks/useQuestionBank'
import { useReviewCards } from './hooks/useReviewCards'
import { useStudyData } from './hooks/useStudyData'
import { useTodayActivity } from './hooks/useTodayActivity'
import { zhTW } from './i18n/zh-TW'
import { db } from './storage/db'
import { requestPersistence, shouldRequestPersistence } from './storage/persistence'
import { isSyncEnabled, setSyncPass, syncNow } from './storage/sync'
import type { SessionMode, StudySession } from './types'

const LEGACY_SESSION_KEY = 'level-b-active-session'
const SEQUENTIAL_KEY = 'level-b-sequential-index'
const EXPLAIN_VERSION = 'v17'
const OPTION_RANDOMIZE_KEY = 'level-b-randomize-options'

function sessionKey(examId: string) {
  return `${LEGACY_SESSION_KEY}:${examId}`
}

function sequentialKey(examId: string) {
  return `${SEQUENTIAL_KEY}:${examId}`
}

function loadSession(examId: string): StudySession | null {
  try {
    const value = localStorage.getItem(sessionKey(examId))
      ?? (examId === 'web-design-b' ? localStorage.getItem(LEGACY_SESSION_KEY) : null)
    const session = value ? JSON.parse(value) as StudySession : null
    return session ? { ...session, examId: session.examId ?? examId } : null
  } catch {
    return null
  }
}

function titleForMode(mode: SessionMode) {
  return zhTW.session.titles[mode]
}

function displaySessionTitle(session: Pick<StudySession, 'mode' | 'title'>): string {
  const legacyTitles: Record<string, string> = {
    'Wrong answers': zhTW.session.titles.wrong,
    'Random 10': zhTW.session.titles.random,
    'Fresh sprint': zhTW.session.titles.fresh,
    'Mini mock 20': zhTW.session.titles.highYield,
    'Due review 10': zhTW.session.titles.adaptive,
    'Commute notes': zhTW.session.titles.commute,
    'Official mock': zhTW.session.titles.mock,
    'Training mock': zhTW.session.trainingMock,
  }
  return legacyTitles[session.title] ?? session.title ?? titleForMode(session.mode)
}

function shouldRandomizeOptions() {
  return localStorage.getItem(OPTION_RANDOMIZE_KEY) !== 'false'
}

function createSession(examId: string, mode: SessionMode, questions: Question[], title?: string, options: { mockFeedback?: boolean; mockDurationMs?: number } = {}): StudySession {
  const now = new Date()
  const randomizeOptions = shouldRandomizeOptions()
  // Mock timing is the pack's official duration (manifest.mockRules), passed in
  // by the caller because this helper has no exam context of its own.
  const mockDurationMs = options.mockDurationMs ?? 0
  return {
    id: crypto.randomUUID(),
    examId,
    mode,
    title: title ?? titleForMode(mode),
    questionIds: questions.map((question) => question.id),
    currentIndex: 0,
    startedAt: now.toISOString(),
    questionStartedAt: now.toISOString(),
    answers: {},
    selections: {},
    optionOrders: Object.fromEntries(questions.map((question) => [question.id, buildOptionOrder(question, { randomize: randomizeOptions })])),
    flags: {},
    mockFeedback: options.mockFeedback,
    mockEndsAt: mode === 'mock' ? new Date(now.getTime() + mockDurationMs).toISOString() : undefined,
    mockRemainingMs: mode === 'mock' ? mockDurationMs : undefined,
  }
}

async function explainQuestion(examId: string, question: Question, selected: number[], style = 'default') {
  // Bump EXPLAIN_VERSION whenever the prompt changes so old cached answers regenerate.
  const selectedKey = style === 'reading' ? 'reading' : [...selected].sort((a, b) => a - b).join(',')
  const optionKey = [
    question.options.join('¦'),
    question.codeBlock ?? '',
    question.optionCodeBlocks?.join('¦') ?? '',
  ].join('§')
  const cacheKey = `${questionKey(examId, question.id)}::${style}::${selectedKey}::${optionKey}::${EXPLAIN_VERSION}`
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

// The English marketing page lives at /en (and /en/*). Like /welcome it always
// shows the landing — an English visitor arriving there should see the English
// page, not be bounced into the (Chinese) app by a returning-visitor cookie.
const isEnPath = (path: string) => path === '/en' || path.startsWith('/en/')
const forcesLanding = (path: string) => path === '/welcome' || isEnPath(path)

// Per-exam SEO page: /exam/<examId>. Returns the id or null.
const examIdFromPath = (path: string): string | null => {
  const match = path.match(/^\/exam\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

// AEO guide page: /guide.
const isGuidePath = (path: string) => path === '/guide' || path === '/guide/'

export default function App() {
  const { installedExams, setActiveExamId } = useActiveExam()
  const [onboarded, setOnboarded] = useState(hasCompletedOnboarding)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const [landingOpen, setLandingOpen] = useState(() => shouldShowLanding({
    onboarded: hasCompletedOnboarding(),
    hasSyncLink: Boolean(readSyncLink(window.location.hash)),
    forceWelcome: forcesLanding(window.location.pathname),
    forceApp: window.location.pathname === '/app',
    standalone,
  }))
  const [lang, setLang] = useState<'zh' | 'en'>(() => isEnPath(window.location.pathname) ? 'en' : 'zh')
  const [examSlug, setExamSlug] = useState<string | null>(() => examIdFromPath(window.location.pathname))
  const [isGuide, setIsGuide] = useState(() => isGuidePath(window.location.pathname))

  const examOnPage = examSlug ? installedExams.find((exam) => exam.examId === examSlug) ?? null : null

  // Report the surface actually rendered, not the URL: a returning visitor gets
  // the app while the URL stays "/", so the URL alone cannot tell discovery from
  // usage. Fires once per load; entering the app from the landing is a click, not
  // a new page, and is covered by its own event below.
  useEffect(() => {
    if (examOnPage) trackInitialView('landing', undefined, `/exam/${examOnPage.examId}`)
    else if (isGuide) trackInitialView('landing', undefined, '/guide')
    else trackInitialView(landingOpen ? 'landing' : 'app')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goHome = () => {
    if (window.location.pathname !== '/') history.pushState(null, '', '/')
    setExamSlug(null)
    setIsGuide(false)
    setLang('zh')
    setLandingOpen(shouldShowLanding({
      onboarded: hasCompletedOnboarding(),
      hasSyncLink: false,
      forceWelcome: false,
      forceApp: false,
      standalone,
    }))
  }

  const enterApp = (examId?: string, source = 'unknown') => {
    if (examId) setActiveExamId(examId)
    // pushState, not replaceState: entering the app is a step forward from the
    // landing, so the browser back button should return to it rather than leave
    // the site. Guard against stacking duplicate /app entries on repeat calls.
    if (window.location.pathname !== '/app') history.pushState(null, '', '/app')
    setExamSlug(null)
    setIsGuide(false)
    setLandingOpen(false)
    // The landing's one job: this is the conversion, and it has no pageview of
    // its own because the document never navigates. The parallel landing_click
    // records which CTA (and which locale) drove it, for the funnel.
    trackEnterApp(examId)
    trackLanding('enter_app', { source, exam_id: examId ?? '(none)', lang })
  }

  // Back/forward re-derives the surface from the URL with the same rules as the
  // first render, so leaving the landing and coming back stays consistent (and a
  // returning visitor, who never pushed a landing entry, still exits cleanly).
  useEffect(() => {
    const onPopState = () => {
      setLang(isEnPath(window.location.pathname) ? 'en' : 'zh')
      setExamSlug(examIdFromPath(window.location.pathname))
      setIsGuide(isGuidePath(window.location.pathname))
      setLandingOpen(shouldShowLanding({
        onboarded: hasCompletedOnboarding(),
        hasSyncLink: Boolean(readSyncLink(window.location.hash)),
        forceWelcome: forcesLanding(window.location.pathname),
        forceApp: window.location.pathname === '/app',
        standalone,
      }))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [standalone])

  if (examOnPage) {
    return (
      <ExamPage
        exam={examOnPage}
        onEnter={() => enterApp(examOnPage.examId, 'exam_page')}
        onHome={goHome}
      />
    )
  }

  if (isGuide) {
    return (
      <GuidePage
        exams={installedExams}
        onEnter={() => enterApp(undefined, 'guide')}
        onHome={goHome}
      />
    )
  }

  if (landingOpen) {
    return (
      <LandingPage
        exams={installedExams}
        onEnter={(source) => enterApp(undefined, source)}
        onSelectExam={(examId) => enterApp(examId, 'exam_card')}
        returning={onboarded}
        t={lang === 'en' ? enLanding : undefined}
        lang={lang}
      />
    )
  }
  if (!onboarded) return <OnboardingGate onComplete={() => setOnboarded(true)} />
  return <StudyApp />
}

function StudyApp() {
  const { activeExam } = useActiveExam()
  const examId = activeExam.examId
  const { bank, error } = useQuestionBank()
  const { progress, setProgress, loading, refresh } = useStudyData(examId)
  const { cards: reviewCards, refresh: refreshReviewCards } = useReviewCards(examId)
  const activity = useTodayActivity(examId, progress, reviewCards)
  const [tab, setTab] = useState<Tab>('home')
  const [session, setSession] = useState<StudySession | null>(() => loadSession(examId))
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [summary, setSummary] = useState<StudySession | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const prefetchedCueSessionRef = useRef('')

  useEffect(() => {
    if (session?.examId && session.examId !== examId) return
    if (session) localStorage.setItem(sessionKey(examId), JSON.stringify(session))
    else localStorage.removeItem(sessionKey(examId))
    localStorage.removeItem(LEGACY_SESSION_KEY)
  }, [examId, session])

  useEffect(() => {
    setSession(loadSession(examId))
    setPracticeOpen(false)
    setSummary(null)
    prefetchedCueSessionRef.current = ''
  }, [examId])

  // A QR scanned with the phone's own camera lands here as /#sync=CODE. Adopt the
  // code before the sync effect below reads it, and strip it from the URL so it
  // stays out of history and out of any link the learner later shares.
  //
  // Also listens for hashchange: an installed PWA that is already open does not
  // reload when the same origin is opened again, so the link would otherwise
  // arrive as a hash change into a mounted app and be ignored.
  useEffect(() => {
    const adopt = () => {
      const scanned = readSyncLink(window.location.hash)
      if (!scanned) return
      setSyncPass(scanned)
      history.replaceState(null, '', window.location.pathname + window.location.search)
      void syncNow(localStorage.getItem(PROFILE_NAME_KEY) ?? '')
        .then(() => Promise.all([refresh(), refreshReviewCards()]))
        .catch(() => undefined)
    }
    adopt()
    window.addEventListener('hashchange', adopt)
    return () => window.removeEventListener('hashchange', adopt)
  }, [refresh, refreshReviewCards])

  // Pull the cloud copy on open and merge it in (no-op if sync is off or fails).
  useEffect(() => {
    if (!isSyncEnabled()) return
    void syncNow(localStorage.getItem(PROFILE_NAME_KEY) ?? '').then(() => Promise.all([refresh(), refreshReviewCards()])).catch(() => undefined)
  }, [refresh, refreshReviewCards])

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

  // Browsers treat IndexedDB as disposable cache — Safari clears it after ~7 days
  // idle, with no warning. Ask them not to, once there is progress worth keeping
  // (asking on first paint is likeliest to be refused, and pointless anyway).
  useEffect(() => {
    if (!shouldRequestPersistence(attempts)) return
    void requestPersistence()
  }, [attempts])

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
        await explainQuestion(examId, question, selected, session.mode === 'commute' ? 'commute' : 'cue').catch(() => undefined)
      }
    })()

    return () => { cancelled = true }
  }, [examId, progress, session, sessionQuestions])

  if (error) return <div className="fatal-state"><AlertTriangle /><h1>{zhTW.session.bankUnavailable}</h1><p>{error}</p></div>
  if (!bank || loading) return <div className="loading-state"><LoaderCircle className="spin" /><strong>{zhTW.session.loadingTitle}</strong><span>{zhTW.session.loadingBody}</span></div>
  const mockDurationMs = mockDurationMilliseconds(activeExam.mockRules)

  const begin = (mode: SessionMode, questions: Question[], title?: string, options?: { mockFeedback?: boolean }) => {
    if (!questions.length) return
    setSummary(null)
    setSession(createSession(examId, mode, questions, title, { ...options, mockDurationMs }))
    setPracticeOpen(true)
  }

  const startMock = (mockFeedback = false) => {
    try {
      begin('mock', buildMockQueue(bank.questions, activeExam.mockRules), mockFeedback ? zhTW.session.trainingMock : zhTW.session.titles.mock, { mockFeedback })
    } catch {
      window.alert(zhTW.session.mockUnavailable)
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
        const remaining = current.mockRemainingMs ?? mockDurationMs
        return { ...current, mockEndsAt: new Date(Date.now() + remaining).toISOString() }
      }
      return current
    })
    setPracticeOpen(true)
  }

  const startSequential = () => {
    const legacy = examId === 'web-design-b' ? localStorage.getItem(SEQUENTIAL_KEY) : null
    const saved = Number(localStorage.getItem(sequentialKey(examId)) ?? legacy ?? 0)
    begin('sequential', bank.questions.slice(Math.min(saved, bank.questions.length - 1), saved + 20))
  }

  const startWrong = () => {
    const wrong = bank.questions.filter((question) => progress[question.id]?.wrong > 0 && progress[question.id].streak < 2)
    begin('wrong', wrong.length ? wrong : bank.questions.slice(0, 20))
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
      window.alert(zhTW.session.noWrongForCommute)
      return
    }
    begin('commute', wrong, zhTW.session.commuteTitle(wrong.length))
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
    const nextProgress = applyAttempt(progress[question.id] ?? createProgress(questionKey(examId, question.id)), {
      selected,
      correct,
      guessed,
      elapsedMs,
      answeredAt,
    })

    let createdReviewCard = false
    await db.transaction('rw', db.progress, db.attempts, db.reviewCards, async () => {
      await db.progress.put(nextProgress)
      await db.attempts.add({ questionId: questionKey(examId, question.id), selected, correct, guessed, elapsedMs, answeredAt: answeredAt.toISOString(), mode: session.mode })
      if (!correct) {
        const id = questionCardId(examId, question.id)
        if (!(await db.reviewCards.get(id))) {
          await db.reviewCards.put(createQuestionCard(examId, question, answeredAt))
          createdReviewCard = true
        }
      }
    })
    if (createdReviewCard) await refreshReviewCards()
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
    const next = { ...(progress[questionId] ?? createProgress(questionKey(examId, questionId))), bookmarked: !(progress[questionId]?.bookmarked ?? false) }
    await db.progress.put(next)
    setProgress((current) => ({ ...current, [questionId]: next }))
  }

  // --- Review cards (Phase 2 memory layer) ---

  const cardQuestionIds = new Set(reviewCards.map((card) => parseQuestionKey(card.questionKeys[0]).questionId))
  const dueCards = buildDueCardQueue(reviewCards, new Date())
  const wrongQuestions = () => bank.questions.filter((question) => progress[question.id]?.wrong > 0 && progress[question.id].streak < 2)
  const wrongWithoutCards = wrongQuestions().filter((question) => !cardQuestionIds.has(question.id)).length

  // --- Daily mission + streak (Phase 3 habit loop) ---

  const attemptTotals: Record<string, number> = {}
  const wrongTotals: Record<string, number> = {}
  for (const [questionId, item] of Object.entries(progress)) {
    attemptTotals[questionId] = item.attempts
    wrongTotals[questionId] = item.wrong
  }
  const mission = buildDailyMission({
    dueCardCount: dueCards.length,
    reviewsDoneToday: activity.reviewsDoneToday,
    wrongBookSize: wrongCount,
    todayAttempts: activity.todayAttempts,
    attemptTotals,
    wrongTotals,
  })
  const streak = studyStreak(activity.activityTimestamps, new Date())

  const addReviewCard = async (question: Question) => {
    if (await db.reviewCards.get(questionCardId(examId, question.id))) return
    await db.reviewCards.put(createQuestionCard(examId, question, new Date()))
    await refreshReviewCards()
  }

  const createWrongCards = async () => {
    const now = new Date()
    const missingCards = wrongQuestions()
      .filter((question) => !cardQuestionIds.has(question.id))
      .map((question) => createQuestionCard(examId, question, now))
    if (!missingCards.length) return
    await db.reviewCards.bulkPut(missingCards)
    await refreshReviewCards()
  }

  const gradeReviewCard = async (card: ReviewCard, rating: ReviewRating) => {
    const { card: graded, log } = gradeCard(card, rating, new Date())
    await db.transaction('rw', db.reviewCards, db.reviewLogs, async () => {
      await db.reviewCards.put(graded)
      await db.reviewLogs.put({ ...log, id: crypto.randomUUID() })
    })
    await refreshReviewCards()
  }

  /** The card's question as published today; undefined once it leaves the pack. */
  const questionForCard = (card: ReviewCard) => bank.byId.get(parseQuestionKey(card.questionKeys[0]).questionId)

  const openCardSource = (card: ReviewCard) => {
    const question = questionForCard(card)
    if (question) begin('item', [question])
  }

  const complete = async () => {
    if (!session) return
    if (session.mode === 'sequential') {
      const lastId = session.questionIds.at(-1)
      const lastIndex = bank.questions.findIndex((question) => question.id === lastId)
      if (lastIndex >= 0) localStorage.setItem(sequentialKey(examId), String(lastIndex + 1))
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
        const next = applyAttempt(progress[entry.id] ?? createProgress(questionKey(examId, entry.id)), { selected: entry.selected!, correct, guessed: false, elapsedMs: 0, answeredAt })
        return { id: entry.id, correct, selected: entry.selected!, next }
      })
      await db.transaction('rw', db.progress, db.attempts, async () => {
        for (const u of updates) {
          await db.progress.put(u.next)
          await db.attempts.add({ questionId: questionKey(examId, u.id), selected: u.selected, correct: u.correct, guessed: false, elapsedMs: 0, answeredAt: answeredAt.toISOString(), mode: session.mode })
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
          const question = bank.byId.get(id)
          const weight = question?.kind === 'multiple' ? activeExam.mockRules.weightMultiple : activeExam.mockRules.weightSingle
          return total + (answer?.correct ? weight : 0)
        }, 0)
        : correct
      const maxScore = isMock ? activeExam.mockRules.maxScore : answers.length
      await db.results.add({
        examId,
        sessionId: session.id,
        mode: session.mode,
        title: session.title,
        finishedAt: new Date().toISOString(),
        answered: answers.length,
        correct,
        score,
        maxScore,
        passed: isMock ? score >= activeExam.mockRules.passScore : maxScore > 0 && correct / maxScore >= 0.6,
        durationMs: Date.now() - new Date(session.startedAt).getTime(),
      })
    }

    setSummary({ ...session, answers: finalAnswers, completed: true })
    setSession(null)
    setPracticeOpen(false)

    // Push this session up to the cloud (no-op if sync is off or offline).
    if (isSyncEnabled()) void syncNow(localStorage.getItem(PROFILE_NAME_KEY) ?? '').catch(() => undefined)
  }

  const explain = async (question: Question, selected: number[], style = 'default') => {
    return explainQuestion(examId, question, selected, style)
  }

  if (practiceOpen && session && sessionQuestions.length) {
    return <PracticeView session={session} questions={bank.byId} progress={progress} onExit={pausePractice} onSelect={onSelect} onSubmit={recordAttempt} onFlashcardGrade={async (question, knewIt) => recordAttempt(question, [], false, knewIt)} onNavigate={navigate} onToggleBookmark={toggleBookmark} onToggleFlag={toggleFlag} onComplete={() => void complete()} onExplain={explain} hasReviewCard={(questionId) => cardQuestionIds.has(questionId)} onAddReviewCard={addReviewCard} />
  }

  if (summary) {
    const summarySession = summary
    const answers = Object.values(summarySession.answers)
    const isMock = summarySession.mode === 'mock'
    const mockScore = isMock ? summarySession.questionIds.reduce((score, id) => {
      const question = bank.byId.get(id)
      const answer = summarySession.answers[id]
      const weight = question?.kind === 'multiple' ? activeExam.mockRules.weightMultiple : activeExam.mockRules.weightSingle
      return score + (answer?.correct ? weight : 0)
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
        <p className="eyebrow">{zhTW.session.recorded}</p>
        <h1>{displaySessionTitle(summarySession)}</h1>
        <strong className="summary-score">{mockScore !== null ? `${Math.round(mockScore * 10) / 10}/${activeExam.mockRules.maxScore}` : `${correct}/${answers.length}`}</strong>
        <p>{mockScore !== null ? (mockScore >= activeExam.mockRules.passScore ? zhTW.session.mockPassNote : zhTW.session.mockFailNote) : zhTW.session.practiceNote}</p>

        {isMock ? (
          <div className="mock-breakdown">
            <div className="section-heading compact"><div><p className="eyebrow">{zhTW.session.breakdownEyebrow}</p><h2>{zhTW.session.breakdownTitle}</h2></div></div>
            <div className="breakdown-list">
              {groupBreakdown.map((group) => {
                const accuracyPct = Math.round((group.correct / group.total) * 100)
                return (
                  <div className={accuracyPct < 60 ? 'breakdown-row weak' : 'breakdown-row'} key={group.section}>
                    <div className="breakdown-head"><strong>{group.label}</strong><span>{group.correct}/{group.total}</span></div>
                    <div className="mini-track"><span style={{ width: `${accuracyPct}%` }} /></div>
                    {group.missed ? <button className="group-practice" onClick={() => begin('adaptive', buildAdaptiveQueue(bank.questions.filter((question) => question.section === group.section), progress, 10), zhTW.session.practiceSuffix(group.label))} type="button">{zhTW.session.practiceGroup} <ArrowRight size={15} /></button> : null}
                  </div>
                )
              })}
            </div>
            {missed.length ? (
              <button className="secondary-action wide" onClick={() => begin('wrong', missed, zhTW.session.reviewMissedTitle)} type="button"><RotateCcw size={16} /> {zhTW.session.reviewMissed(missed.length)}</button>
            ) : null}
          </div>
        ) : null}

        <div className="summary-actions">
          <button className="primary-action" onClick={() => { setSummary(null); setTab('home') }} type="button">{zhTW.session.backToHome}</button>
          <button className="secondary-action" onClick={() => begin(summarySession.mode, summarySession.questionIds.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q), displaySessionTitle(summarySession), { mockFeedback: summarySession.mockFeedback })} type="button"><RotateCcw size={17} /> {zhTW.session.repeatSession}</button>
        </div>
      </main>
    )
  }

  return (
    <div className="app-frame">
      <ActiveExamHeader onSettingsOpenChange={setSettingsOpen} progress={progress} questions={bank.questions} settingsOpen={settingsOpen} />
      {tab === 'home' ? <HomePage onOpenSettings={() => setSettingsOpen(true)} seen={seen} total={bank.questions.length} due={due} accuracy={accuracy} hasSession={!!session} sessionLabel={session ? displaySessionTitle(session) : undefined} streak={streak} mission={mission} onGoReview={() => setTab('review')} onWrongFix={startWrong} onContinue={resumePractice} onSequential={startSequential} /> : null}
      {tab === 'practice' ? <PracticePage questions={bank.questions} progress={progress} total={bank.questions.length} onSequential={startSequential} onRandom={() => begin('random', buildRandomQueue(bank.questions, 10))} onFresh={(limit) => begin('fresh', buildFreshQueue(bank.questions, progress, limit), zhTW.session.freshTitle(limit))} onHighYield={() => begin('highYield', buildHighYieldQueue(bank.questions, progress, 20))} onSubject={(subjectCode, title) => begin('random', buildRandomQueue(bank.questions.filter((question) => question.subjectCode === subjectCode), 10), title)} onOpenQuestion={(question) => begin('item', [question])} onSprint={() => begin('sprint', buildSprintQueue(bank.questions, progress, 20))} /> : null}
      {tab === 'review' ? <ReviewPage due={due} wrongCount={wrongCount} dueCards={dueCards} totalCards={reviewCards.length} wrongWithoutCards={wrongWithoutCards} onGradeCard={gradeReviewCard} onOpenCardSource={openCardSource} resolveCardQuestion={questionForCard} onCreateWrongCards={createWrongCards} onAdaptive={() => begin('adaptive', buildAdaptiveQueue(bank.questions, progress, 10))} onWrong={startWrong} onFlashcards={() => begin('flashcard', buildAdaptiveQueue(bank.questions, progress, 10), zhTW.session.titles.flashcard)} onCommuteNotes={startCommuteNotes} onPracticeSection={(section, title) => begin('adaptive', buildAdaptiveQueue(bank.questions.filter((question) => question.section === section), progress, 10), title)} /> : null}
      {tab === 'mock' ? <MockExamPage onMock={() => startMock(false)} onMockTraining={() => startMock(true)} /> : null}
      {tab === 'insights' ? <InsightsPage questions={bank.questions} progress={progress} reviewCards={reviewCards} streak={streak} onPracticeGroup={(section, title) => begin('adaptive', buildAdaptiveQueue(bank.questions.filter((question) => question.section === section), progress, 10), zhTW.session.practiceSuffix(title))} /> : null}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
