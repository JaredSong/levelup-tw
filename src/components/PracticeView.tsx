import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BrainCircuit,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  Image as ImageIcon,
  Languages,
  LayoutGrid,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Progress, Question } from '../domain/studyEngine'
import type { StudySession } from '../types'

interface Props {
  session: StudySession
  questions: Map<string, Question>
  progress: Record<string, Progress>
  onExit: () => void
  onSelect: (questionId: string, selected: number[]) => void
  onSubmit: (question: Question, selected: number[], guessed: boolean) => Promise<void>
  onFlashcardGrade: (question: Question, knewIt: boolean) => Promise<void>
  onNavigate: (index: number) => void
  onToggleBookmark: (questionId: string) => Promise<void>
  onToggleFlag: (questionId: string) => void
  onComplete: () => void
  onExplain: (question: Question, selected: number[], style?: string) => Promise<string>
}

const EMPTY_SELECTION: number[] = []

// Lightweight renderer: turns **bold**, line breaks, and "- " bullets into real
// formatting so the model's Markdown doesn't show as literal text. No HTML injection.
function renderInline(text: string) {
  return text.split('**').map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))
}

function renderExplanation(text: string) {
  return text.split('\n').map((raw, lineIndex) => {
    const line = raw.trim()
    if (!line) return null
    const isBullet = /^[-*•]\s+/.test(line)
    const content = isBullet ? line.replace(/^[-*•]\s+/, '') : line
    return (
      <p className={isBullet ? 'ai-line ai-bullet' : 'ai-line'} key={lineIndex}>
        {isBullet ? '• ' : ''}{renderInline(content)}
      </p>
    )
  })
}

function stripSpeakerLabel(text: string) {
  return text.replace(/^(主持人|老師|Teacher|Host)\s*[:：]\s*/i, '')
}

function speakerForLine(text: string): 'host' | 'teacher' {
  return /^(老師|Teacher)\s*[:：]/i.test(text.trim()) ? 'teacher' : 'host'
}

function chooseVoicePair(voices: SpeechSynthesisVoice[]) {
  const zhVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
  if (!zhVoices.length) return { host: null, teacher: null }

  const maleHints = ['male', '男', 'li-mu', 'limu', 'yunxi', 'yunjian', 'yunye']
  const femaleHints = ['female', '女', 'mei', 'ting', 'yating', 'sinji', 'hsiao', 'xiaoxiao']
  const matches = (voice: SpeechSynthesisVoice, hints: string[]) => {
    const label = `${voice.name} ${voice.voiceURI}`.toLowerCase()
    return hints.some((hint) => label.includes(hint.toLowerCase()))
  }
  const langRank = (voice: SpeechSynthesisVoice) => {
    const lang = voice.lang.toLowerCase()
    if (lang === 'zh-tw') return 0
    if (lang === 'zh-hk') return 1
    if (lang === 'zh-cn') return 2
    return 3
  }
  const sorted = [...zhVoices].sort((left, right) => langRank(left) - langRank(right))
  const isSameVoice = (left: SpeechSynthesisVoice | null, right: SpeechSynthesisVoice | null) => (
    !!left && !!right && left.name === right.name && left.lang === right.lang
  )

  const host = sorted.find((voice) => matches(voice, femaleHints))
    ?? sorted.find((voice) => voice.lang.toLowerCase() === 'zh-tw')
    ?? sorted[0]
  const teacher = sorted.find((voice) => matches(voice, maleHints) && !isSameVoice(voice, host))
    ?? sorted.find((voice) => !matches(voice, femaleHints) && !isSameVoice(voice, host))
    ?? sorted.find((voice) => !isSameVoice(voice, host))
    ?? host

  return { host, teacher }
}

function formatClock(totalSeconds: number) {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60))
  const seconds = Math.max(0, totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildBasicCommuteNote(question: Question) {
  const correctChoices = question.answers
    .map((value) => `官方第 ${value} 項，${question.options[value - 1]}`)
    .join('；')
  const answerNumbers = question.answers.map((value) => `官方第 ${value} 項`).join('、')
  const kind = question.kind === 'multiple' ? '複選題' : '單選題'

  return [
    `主持人：來，這題是${kind}。題目重點是：${question.prompt}`,
    `老師：先抓官方正解。這題要記的是：${correctChoices}。你考試時，不要只背位置，要背正確敘述本身。`,
    `老師：English memory cue: treat the right answer like the label on a drawer. Find the label first, then match the number.`,
    `主持人：好，答案記住：${answerNumbers}。下一題。`,
  ].join('\n')
}

function QuestionFigure({ question }: { question: Question }) {
  const customImages = question.sourceImages?.length ? question.sourceImages : question.sourceImage ? [question.sourceImage] : []
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    setUseFallback(false)
  }, [question.id, question.sourceImage, question.sourceImages])

  const figureSources = useFallback || !customImages.length
    ? question.sourcePageImage ? [question.sourcePageImage] : []
    : customImages

  if (!figureSources.length) return null

  const showingSourcePage = figureSources.every((source) => source === question.sourcePageImage || source.includes('/question-pages/'))

  return (
    <figure className={showingSourcePage ? 'source-figure source-page' : 'source-figure question-crop'}>
      {figureSources.map((source, index) => (
        <img
          src={source}
          alt={`Official source figure ${index + 1} for ${question.id}`}
          key={source}
          onError={() => {
            if (question.sourcePageImage && !showingSourcePage) setUseFallback(true)
          }}
        />
      ))}
    </figure>
  )
}

export function PracticeView({
  session,
  questions,
  progress,
  onExit,
  onSelect,
  onSubmit,
  onFlashcardGrade,
  onNavigate,
  onToggleBookmark,
  onToggleFlag,
  onComplete,
  onExplain,
}: Props) {
  const [guessed, setGuessed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [priorSelection, setPriorSelection] = useState<number[]>([])
  const [reading, setReading] = useState<string | null>(null)
  const [readingLoading, setReadingLoading] = useState(false)
  const [readingError, setReadingError] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const finishedRef = useRef(false)
  const autoExplainRef = useRef('')
  const progressRef = useRef(progress)
  progressRef.current = progress

  const questionId = session.questionIds[session.currentIndex]
  const question = questions.get(questionId)
  const selected = session.selections[questionId] ?? EMPTY_SELECTION
  const answer = session.answers[questionId]
  const isMock = session.mode === 'mock'
  const showMockFeedback = isMock && !!session.mockFeedback
  const isFlashcard = session.mode === 'flashcard'
  const isCommute = session.mode === 'commute'
  const isLast = session.currentIndex === session.questionIds.length - 1
  const [speaking, setSpeaking] = useState(false)
  const [playlist, setPlaylist] = useState(false)

  const total = session.questionIds.length
  const flags = session.flags ?? {}
  const isFlagged = !!flags[questionId]
  const answeredCount = session.questionIds.filter((id) => session.selections[id]?.length).length
  const flaggedIndexes = session.questionIds.map((id, index) => (flags[id] ? index : -1)).filter((index) => index >= 0)
  const unansweredIndexes = session.questionIds.map((id, index) => (session.selections[id]?.length ? -1 : index)).filter((index) => index >= 0)
  const selectedForExplain = useMemo(
    () => isCommute
      ? (priorSelection.length ? priorSelection : progress[questionId]?.lastSelected ?? [])
      : selected,
    [isCommute, priorSelection, progress, questionId, selected],
  )
  const optionOrder = useMemo(() => {
    if (!question) return []
    return session.optionOrders?.[question.id]?.length === question.options.length
      ? session.optionOrders[question.id]
      : question.options.map((_, index) => index + 1)
  }, [question, session.optionOrders])
  const formatDisplayChoices = useCallback((values: number[]) => values
    .map((value) => {
      const displayIndex = optionOrder.indexOf(value)
      return displayIndex >= 0 ? displayIndex + 1 : value
    })
    .join('、'), [optionOrder])
  const toDisplayValues = useCallback((values: number[]) => values
    .map((value) => {
      const displayIndex = optionOrder.indexOf(value)
      return displayIndex >= 0 ? displayIndex + 1 : value
    }), [optionOrder])
  const questionForScreenOrder = useMemo(() => {
    if (!question || !optionOrder.length) return question
    return {
      ...question,
      options: optionOrder.map((value) => question.options[value - 1]),
      answers: toDisplayValues(question.answers),
    }
  }, [optionOrder, question, toDisplayValues])
  const aiCommuteNote = explanation?.trim() ?? ''
  const basicCommuteNote = useMemo(
    () => question && isCommute ? buildBasicCommuteNote(question) : '',
    [isCommute, question],
  )
  const playableExplanation = aiCommuteNote || basicCommuteNote

  useEffect(() => {
    setGuessed(false)
    setRevealed(false)
    setExplanation(null)
    setExplainError(null)
    setReading(null)
    setReadingError(null)
    setSpeaking(false)
    if (!playlist) window.speechSynthesis?.cancel()
    // Capture the previous answer once per question, before this session overwrites it.
    setPriorSelection(progressRef.current[questionId]?.lastSelected ?? [])
  }, [playlist, questionId])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const secondsRemaining = session.mockEndsAt
    ? Math.ceil((new Date(session.mockEndsAt).getTime() - now) / 1000)
    : Math.floor((now - new Date(session.startedAt).getTime()) / 1000)

  // Auto-submit a mock when the 100-minute clock runs out.
  useEffect(() => {
    if (isMock && session.mockEndsAt && secondsRemaining <= 0 && !finishedRef.current) {
      finishedRef.current = true
      onComplete()
    }
  }, [isMock, session.mockEndsAt, secondsRemaining, onComplete])

  const requestExplanation = useCallback(async (style = 'default') => {
    if (!question) return
    const explainQuestion = isCommute ? question : (questionForScreenOrder ?? question)
    const explainSelected = isCommute || style === 'reading' ? selectedForExplain : toDisplayValues(selectedForExplain)
    setExplaining(true)
    setExplainError(null)
    try {
      setExplanation(await onExplain(explainQuestion, explainSelected, style))
    } catch (reason) {
      setExplainError(reason instanceof Error ? reason.message : 'Explanation is unavailable.')
    } finally {
      setExplaining(false)
    }
  }, [isCommute, onExplain, question, questionForScreenOrder, selectedForExplain, toDisplayValues])

  useEffect(() => {
    if (!question || !answer || answer.correct || isFlashcard || (isMock && !showMockFeedback)) return
    const selectedKey = [...selectedForExplain].sort((a, b) => a - b).join(',')
    const autoKey = `${question.id}::${selectedKey}`
    if (!selectedKey || autoExplainRef.current === autoKey) return
    autoExplainRef.current = autoKey
    void requestExplanation()
  }, [answer, isFlashcard, isMock, question, requestExplanation, selectedForExplain, showMockFeedback])

  useEffect(() => {
    if (!question || !isFlashcard || !revealed || explanation || explaining) return
    if (!window.localStorage.getItem('level-b-ai-access-token')) return
    const autoKey = `${question.id}::cue`
    if (autoExplainRef.current === autoKey) return
    autoExplainRef.current = autoKey
    void requestExplanation('cue')
  }, [explaining, explanation, isFlashcard, question, requestExplanation, revealed])

  useEffect(() => {
    if (!question || !isCommute || explanation || explaining) return
    if (!window.localStorage.getItem('level-b-ai-access-token')) return
    const selectedKey = [...selectedForExplain].sort((a, b) => a - b).join(',')
    const autoKey = `${question.id}::commute::${selectedKey}`
    if (autoExplainRef.current === autoKey) return
    autoExplainRef.current = autoKey
    void requestExplanation('commute')
  }, [explaining, explanation, isCommute, question, requestExplanation, selectedForExplain])

  const progressPercent = Math.round(((session.currentIndex + 1) / session.questionIds.length) * 100)
  const correctChoices = useMemo(() => new Set(question?.answers ?? []), [question])

  const speakNote = useCallback((continuePlaylist = false) => {
    const note = playableExplanation.trim()
    if (!note) {
      setExplainError('This note is empty. Regenerate it once, then play.')
      return
    }
    if (!('speechSynthesis' in window)) {
      setExplainError('Voice playback is not supported in this browser. Open the app in Safari or Chrome.')
      return
    }
    window.speechSynthesis.cancel()
    setExplainError(null)
    const segments = note
      .replace(/\*\*/g, '')
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s+/, '').trim())
      .filter(Boolean)
      .map((line) => ({
        speaker: speakerForLine(line),
        text: stripSpeakerLabel(line),
      }))
    const spokenSegments = segments.length
      ? segments
      : [{ speaker: 'host' as const, text: stripSpeakerLabel(note.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()) }]
    const voices = window.speechSynthesis.getVoices()
    const voicePair = chooseVoicePair(voices)
    const sameVoice = voicePair.host && voicePair.teacher
      ? voicePair.host.name === voicePair.teacher.name && voicePair.host.lang === voicePair.teacher.lang
      : true
    const finish = () => {
      setSpeaking(false)
      if (continuePlaylist && !isLast) onNavigate(session.currentIndex + 1)
      else setPlaylist(false)
    }
    let index = 0
    const speakNext = () => {
      const segment = spokenSegments[index]
      if (!segment) {
        finish()
        return
      }
      const utterance = new SpeechSynthesisUtterance(segment.text)
      utterance.lang = 'zh-TW'
      utterance.rate = segment.speaker === 'teacher' ? (sameVoice ? 0.78 : 0.84) : 0.96
      utterance.pitch = segment.speaker === 'teacher' ? (sameVoice ? 0.55 : 0.72) : 1.08
      utterance.volume = 1
      utterance.voice = segment.speaker === 'teacher' ? voicePair.teacher : voicePair.host
      utterance.onend = () => {
        index += 1
        window.setTimeout(speakNext, segment.speaker === 'teacher' ? 520 : 360)
      }
      utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    }
    setSpeaking(true)
    speakNext()
  }, [isLast, onNavigate, playableExplanation, session.currentIndex])

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    setPlaylist(false)
  }

  useEffect(() => {
    if (!playlist || !isCommute || !playableExplanation || speaking) return
    speakNote(true)
  }, [isCommute, playableExplanation, playlist, speakNote, speaking])

  if (!question) return null

  // Some figure questions have image-only options ("圖示選項 N"); the real
  // choices live in the source figure, so surface it instead of looking buggy.
  const optionsAreImages = question.options.some((option) => option.includes('圖示'))

  const toggleOption = (option: number) => {
    if (answer || isFlashcard) return
    if (question.kind === 'single') onSelect(question.id, [option])
    else onSelect(question.id, selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])
  }

  const submit = async () => {
    if (!selected.length || answer) return
    await onSubmit(question, selected, guessed)
    if (isMock && !showMockFeedback && !isLast) onNavigate(session.currentIndex + 1)
  }

  const next = () => {
    if (isLast) onComplete()
    else onNavigate(session.currentIndex + 1)
  }

  // Reading help is translation-only; it never sees or reveals the answer.
  const requestReading = async () => {
    setReadingLoading(true)
    setReadingError(null)
    try {
      setReading(await onExplain(isCommute ? question : (questionForScreenOrder ?? question), [], 'reading'))
    } catch (reason) {
      setReadingError(reason instanceof Error ? reason.message : 'Reading help is unavailable.')
    } finally {
      setReadingLoading(false)
    }
  }

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="icon-button" onClick={onExit} aria-label="Exit session" type="button"><ArrowLeft size={21} /></button>
        <div className="practice-title">
          <strong>{session.title}</strong>
          <span>{session.currentIndex + 1} of {session.questionIds.length}</span>
        </div>
        <div className={isMock && secondsRemaining < 600 ? 'session-clock urgent' : 'session-clock'}>
          <Clock3 size={15} /> {formatClock(secondsRemaining)}
        </div>
      </header>
      <div className="practice-progress"><span style={{ width: `${progressPercent}%` }} /></div>

      {isMock ? (
        <div className="mock-toolbar">
          <button className={isFlagged ? 'flag-btn flagged' : 'flag-btn'} onClick={() => onToggleFlag(question.id)} type="button">
            <Flag size={15} fill={isFlagged ? 'currentColor' : 'none'} /> {isFlagged ? 'Flagged' : 'Flag'}
          </button>
          <span className="mock-count">{answeredCount}/{total} answered{flaggedIndexes.length ? ` · ${flaggedIndexes.length} flagged` : ''}</span>
          <button className="nav-open" onClick={() => setNavOpen(true)} type="button"><LayoutGrid size={15} /> Navigator</button>
        </div>
      ) : null}

      <section className="question-stage">
        <div className="question-meta">
          <span>{question.id}</span>
          <span>{question.sectionTitle}</span>
          <span>{question.kind === 'multiple' ? 'Multiple answer' : 'Single answer'}</span>
          <button className={progress[question.id]?.bookmarked ? 'saved' : ''} onClick={() => void onToggleBookmark(question.id)} aria-label="Bookmark question" type="button">
            <Bookmark size={18} fill={progress[question.id]?.bookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <h1>{question.prompt}</h1>

        <QuestionFigure question={question} />

        {optionsAreImages ? (
          <p className="figure-note"><ImageIcon size={15} /> This question’s options are images — read them on the figure above; pick the matching number below.</p>
        ) : null}

        {isCommute ? (
          <section className="commute-card">
              <p className="answer-label">{aiCommuteNote ? 'AI commute voice note' : 'Basic commute voice note'}</p>
              <div className="answer-summary">
                <span><strong>Your last choice:</strong> {priorSelection.length ? priorSelection.join('、') : '—'}</span>
                <span className="official"><strong>Official correct:</strong> {question.answers.join('、')}</span>
              </div>
              {playableExplanation ? (
                <div className="ai-explanation commute-note commute-transcript">{renderExplanation(playableExplanation)}</div>
              ) : null}
            <div className="commute-reference">
              <p className="answer-label">Official choices reference</p>
              {question.options.map((option, index) => {
                const officialValue = index + 1
                // Commute notes are for exam memorisation, so keep the official
                // source order even though normal practice shuffles options.
                return (
                <span className={correctChoices.has(officialValue) ? 'correct-ref' : ''} key={officialValue}>
                  {officialValue}. {option}
                </span>
                )
              })}
            </div>
            {explaining ? <p className="commute-loading"><LoaderCircle className="spin" size={16} /> Generating and caching this memory cue…</p> : null}
            {explainError ? <p className="inline-error">{explainError}</p> : null}
            <div className="commute-actions">
              <button className="primary-action" disabled={!playableExplanation || speaking} onClick={() => { setPlaylist(false); speakNote(false) }} type="button"><Volume2 size={18} /> Play note</button>
              <button className="secondary-action" disabled={!playableExplanation || speaking || isLast} onClick={() => { setPlaylist(true); speakNote(true) }} type="button"><Volume2 size={18} /> Play playlist</button>
              <button className="secondary-action" disabled={!speaking} onClick={stopSpeaking} type="button"><Square size={16} /> Stop</button>
              <button className="secondary-action" disabled={explaining} onClick={() => void requestExplanation('commute')} type="button"><BrainCircuit size={18} /> {aiCommuteNote ? 'Regenerate AI' : 'Upgrade with AI'}</button>
            </div>
          </section>
        ) : null}

        {!isFlashcard && !isCommute ? (
          <div className="reading-help">
            <button className="reading-button" disabled={readingLoading} onClick={() => void requestReading()} type="button">
              <Languages size={17} /> {readingLoading ? '解析中…' : '看懂題目 · understand the question'}
            </button>
            {reading ? <div className="ai-explanation reading-panel">{renderExplanation(reading)}</div> : null}
            {readingError ? <p className="inline-error">{readingError}</p> : null}
          </div>
        ) : null}

        {isFlashcard ? (
          <div className="flashcard-answer">
            {!revealed && !answer ? (
              <button className="primary-action" onClick={() => setRevealed(true)} type="button"><Lightbulb size={19} /> Reveal answer</button>
            ) : (
              <>
                <p className="answer-label">Correct answer</p>
                <div className="revealed-options">
                  {question.answers.map((value) => <span key={value}>{formatDisplayChoices([value])}. {question.options[value - 1]}</span>)}
                </div>
                <button className="explain-button flashcard-cue" disabled={explaining} onClick={() => void requestExplanation('cue')} type="button">
                  <BrainCircuit size={18} /> {explaining ? 'Writing mind note…' : 'Mind note'}
                </button>
                {explanation ? <div className="ai-explanation">{renderExplanation(explanation)}</div> : null}
                {explainError ? <p className="inline-error">{explainError}</p> : null}
                {!answer ? (
                  <div className="grade-actions">
                    <button onClick={() => void onFlashcardGrade(question, false)} type="button"><RotateCcw size={18} /> Need review</button>
                    <button className="success" onClick={() => void onFlashcardGrade(question, true)} type="button"><Check size={18} /> Knew it</button>
                  </div>
                ) : <button className="primary-action" onClick={next} type="button">{isLast ? 'Finish session' : 'Next card'} <ChevronRight size={18} /></button>}
              </>
            )}
          </div>
        ) : !isCommute ? (
          <div className={`option-list ${question.kind}`}>
            {question.kind === 'multiple' ? (
              <p className="kind-hint"><CheckSquare size={15} /> 複選題 · select all correct answers</p>
            ) : null}
            {optionOrder.map((value, index) => {
              const option = question.options[value - 1]
              const displayValue = index + 1
              const isSelected = selected.includes(value)
              const isCorrectChoice = !!answer && correctChoices.has(value)
              const isWrongChoice = !!answer && isSelected && !isCorrectChoice
              const classes = [isSelected ? 'selected' : '', isCorrectChoice ? 'correct' : '', isWrongChoice ? 'wrong' : ''].filter(Boolean).join(' ')
              return (
                <button className={classes} key={value} onClick={() => toggleOption(value)} type="button">
                  <span className="opt-box" aria-hidden="true">
                    {isSelected ? (question.kind === 'multiple' ? <Check size={14} strokeWidth={3} /> : <span className="opt-dot" />) : null}
                  </span>
                  <span className="opt-num">{displayValue}</span>
                  <span className="opt-text">{option}</span>
                  {isCorrectChoice ? <Check size={18} /> : isWrongChoice ? <X size={18} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}

        {!isFlashcard && !isCommute && !answer && !isMock ? (
          <label className="guess-toggle">
            <input checked={guessed} onChange={(event) => setGuessed(event.target.checked)} type="checkbox" />
            <span><Flag size={16} /> I am guessing; keep this in review even if correct.</span>
          </label>
        ) : null}

        {!isFlashcard && !isCommute && answer && (!isMock || showMockFeedback) ? (
          <section className={answer.correct ? 'feedback correct' : 'feedback wrong'}>
            <div>
              {answer.correct ? <Check size={20} /> : <X size={20} />}
              <strong>{answer.correct ? (answer.guessed ? 'Correct, but still learning' : 'Correct') : 'Not yet'}</strong>
            </div>
            <p>{answer.correct
              ? (answer.guessed
                ? 'Marked as a guess — it stays in review.'
                : ((progress[question.id]?.streak ?? 0) >= 2 ? 'Mastered — two correct in a row.' : 'Correct — one more in a row to master.'))
              : 'You will see this item again soon.'}</p>
            <div className="answer-summary">
              <span><strong>You chose:</strong> {selected.length ? formatDisplayChoices(selected) : '—'}</span>
              <span className="official"><strong>Correct:</strong> {formatDisplayChoices(question.answers)}</span>
              {priorSelection.length && JSON.stringify([...priorSelection].sort()) !== JSON.stringify([...selected].sort())
                ? <span className="earlier"><strong>Earlier you chose:</strong> {formatDisplayChoices(priorSelection)}</span>
                : null}
            </div>
            <button className="explain-button" disabled={explaining} onClick={() => void requestExplanation()} type="button">
              <BrainCircuit size={18} /> {explaining ? 'Writing short explanation…' : 'Ask AI about my choice'}
            </button>
            {explanation ? <div className="ai-explanation">{renderExplanation(explanation)}</div> : null}
            {explanation ? (
              <div className="explain-styles">
                <span>Re-explain:</span>
                <button disabled={explaining} onClick={() => void requestExplanation('metaphor')} type="button">With a metaphor</button>
                <button disabled={explaining} onClick={() => void requestExplanation('simpler')} type="button">Simpler</button>
                <button disabled={explaining} onClick={() => void requestExplanation('deeper')} type="button">Go deeper</button>
              </div>
            ) : null}
            {explainError ? <p className="inline-error">{explainError}</p> : null}
          </section>
        ) : null}
      </section>

      <footer className="practice-actions">
        <button className="secondary-action" disabled={session.currentIndex === 0} onClick={() => onNavigate(session.currentIndex - 1)} type="button"><ChevronLeft size={19} /> Previous</button>
        {question.kind === 'multiple' && !answer && !isFlashcard && !isCommute ? (
          <span className="select-count">{selected.length} selected</span>
        ) : null}
        {isMock ? (
          showMockFeedback
            ? (!answer
                ? <button className="primary-action" disabled={!selected.length} onClick={() => void submit()} type="button">Check answer <ChevronRight size={19} /></button>
                : isLast
                  ? <button className="primary-action" onClick={() => setReviewOpen(true)} type="button">Review &amp; submit <ChevronRight size={19} /></button>
                  : <button className="primary-action" onClick={() => onNavigate(session.currentIndex + 1)} type="button">Next <ChevronRight size={19} /></button>)
            : isLast
              ? <button className="primary-action" onClick={() => setReviewOpen(true)} type="button">Review &amp; submit <ChevronRight size={19} /></button>
              : <button className="primary-action" onClick={() => onNavigate(session.currentIndex + 1)} type="button">Next <ChevronRight size={19} /></button>
        ) : isCommute ? (
          <button className="primary-action" onClick={next} type="button">{isLast ? 'Finish notes' : 'Next note'} <ChevronRight size={19} /></button>
        ) : !isFlashcard && !answer ? (
          <button className="primary-action" disabled={!selected.length} onClick={() => void submit()} type="button">Check answer <ChevronRight size={19} /></button>
        ) : !isFlashcard ? (
          <button className="primary-action" onClick={next} type="button">{isLast ? 'Finish session' : 'Next'} <ChevronRight size={19} /></button>
        ) : <span />}
      </footer>

      {isMock && navOpen ? (
        <div className="mock-overlay" onClick={() => setNavOpen(false)}>
          <div className="mock-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head"><h2>Questions</h2><button className="icon-button" onClick={() => setNavOpen(false)} aria-label="Close" type="button"><X size={20} /></button></div>
            <div className="nav-legend">
              <span><i className="dot current" /> Current</span>
              <span><i className="dot answered" /> Answered</span>
              <span><i className="dot" /> Unanswered</span>
              <span><i className="dot flagged" /> Flagged</span>
            </div>
            <div className="nav-grid">
              {session.questionIds.map((id, index) => {
                const cls = ['nav-cell', index === session.currentIndex ? 'current' : '', session.selections[id]?.length ? 'answered' : '', flags[id] ? 'flagged' : ''].filter(Boolean).join(' ')
                return <button className={cls} key={id} onClick={() => { onNavigate(index); setNavOpen(false) }} type="button">{index + 1}</button>
              })}
            </div>
            <button className="primary-action" onClick={() => { setNavOpen(false); setReviewOpen(true) }} type="button">Review &amp; submit</button>
          </div>
        </div>
      ) : null}

      {isMock && reviewOpen ? (
        <div className="mock-overlay" onClick={() => setReviewOpen(false)}>
          <div className="mock-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head"><h2>Submit mock?</h2><button className="icon-button" onClick={() => setReviewOpen(false)} aria-label="Close" type="button"><X size={20} /></button></div>
            <p className="review-summary">{answeredCount} of {total} answered{flaggedIndexes.length ? ` · ${flaggedIndexes.length} flagged` : ''}.</p>
            {unansweredIndexes.length ? (
              <div className="review-block">
                <p className="review-label warn"><AlertTriangle size={15} /> {unansweredIndexes.length} unanswered — tap to jump</p>
                <div className="chip-row">{unansweredIndexes.map((index) => <button className="chip" key={index} onClick={() => { onNavigate(index); setReviewOpen(false) }} type="button">{index + 1}</button>)}</div>
              </div>
            ) : <p className="review-label ok"><Check size={15} /> Every question is answered.</p>}
            {flaggedIndexes.length ? (
              <div className="review-block">
                <p className="review-label"><Flag size={15} /> Flagged — tap to jump</p>
                <div className="chip-row">{flaggedIndexes.map((index) => <button className="chip" key={index} onClick={() => { onNavigate(index); setReviewOpen(false) }} type="button">{index + 1}</button>)}</div>
              </div>
            ) : null}
            <div className="review-actions">
              <button className="secondary-action" onClick={() => setReviewOpen(false)} type="button">Keep reviewing</button>
              <button className="primary-action" onClick={onComplete} type="button">Submit mock</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
