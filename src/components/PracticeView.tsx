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
  Layers3,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Progress, Question } from '../domain/studyEngine'
import { zhTW } from '../i18n/zh-TW'
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
  hasReviewCard: (questionId: string) => boolean
  onAddReviewCard: (question: Question) => Promise<void>
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

function renderCodeInline(line: string) {
  const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:int|if|else|switch|case|default|while|for|return|cout|cin)\b|\d+|==|<=|>=|&&|\|\||<<|>>|[{}()[\];?:,+\-*/=<>])/g
  const parts = line.split(tokenPattern).filter((part) => part.length > 0)
  return parts.map((part, index) => {
    let className = ''
    if (/^"(?:\\.|[^"\\])*"$|^'(?:\\.|[^'\\])*'$/.test(part)) className = 'code-string'
    else if (/^\d+$/.test(part)) className = 'code-number'
    else if (/^(?:int|if|else|switch|case|default|while|for|return)$/.test(part)) className = 'code-keyword'
    else if (/^(?:cout|cin)$/.test(part)) className = 'code-io'
    else if (/^(?:==|<=|>=|&&|\|\||<<|>>|[{}()[\];?:,+\-*/=<>])$/.test(part)) className = 'code-punct'
    return <span className={className || undefined} key={`${part}-${index}`}>{part}</span>
  })
}

function CodeBlock({ code, compact = false }: { code: string; compact?: boolean }) {
  return (
    <pre className={compact ? 'code-block compact' : 'code-block'}><code>
      {code.split('\n').map((line, index) => (
        <span className="code-line" key={index}>{renderCodeInline(line || ' ')}</span>
      ))}
    </code></pre>
  )
}

function stripSpeakerLabel(text: string) {
  return text.replace(/^(主持人|老師|Teacher|Host)\s*[:：]\s*/i, '')
}

function speakerForLine(text: string): 'host' | 'teacher' {
  return /^(老師|Teacher)\s*[:：]/i.test(text.trim()) ? 'teacher' : 'host'
}

function chooseChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const zh = voices.filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
  if (!zh.length) return null
  return zh.find((voice) => ['zh-tw', 'zh-hant'].some((hint) => voice.lang.toLowerCase().includes(hint))) ?? zh[0]
}

function formatClock(totalSeconds: number) {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60))
  const seconds = Math.max(0, totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildBasicCommuteNote(question: Question) {
  const correctChoices = question.answers
    .map((value) => `option ${value} (${question.options[value - 1]})`)
    .join(', ')
  const kind = question.kind === 'multiple' ? 'a multiple-answer question' : 'a single-answer question'

  return [
    `Quick review. This is ${kind}. The question asks: ${question.prompt}`,
    `The correct answer is ${correctChoices}.`,
    `This is the basic voice note — it reads the question and the official answer. For the reason and a memory hook, tap "Upgrade with AI".`,
  ].join('\n')
}

function usesImageOptionPlaceholders(question: Question) {
  return question.options.some((option) => option.includes('圖示選項'))
}

function optionImageSources(question: Question) {
  if (question.optionCodeBlocks?.some(Boolean)) return []
  if (!usesImageOptionPlaceholders(question) || !question.sourceImages?.length) return []
  if (question.sourceImages.length === question.options.length) return question.sourceImages
  if (question.sourceImages.length === question.options.length + 1) return question.sourceImages.slice(1)
  return []
}

function figureImageSources(question: Question) {
  const customImages = question.sourceImages?.length ? question.sourceImages : question.sourceImage ? [question.sourceImage] : []
  if (usesImageOptionPlaceholders(question)) {
    if (question.sourceImages?.length === question.options.length + 1) return [question.sourceImages[0]]
    if (question.sourceImage && !question.sourceImages?.length) return [question.sourceImage]
    return []
  }
  return customImages
}

/**
 * Image-option questions ask the learner to tell four marks apart, so the whole
 * answer is visible in the source page scan. Falling back to that scan doesn't
 * just look bad — it hands over the answer. Better to show no figure and let the
 * option images speak, so a missing crop degrades into a broken option (loud,
 * caught by the integrity test) instead of a leaked answer (silent).
 */
function allowsSourcePageFallback(question: Question) {
  return !usesImageOptionPlaceholders(question)
}

function QuestionFigure({ question }: { question: Question }) {
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    setUseFallback(false)
  }, [question.id, question.sourceImage, question.sourceImages])

  const customImages = figureImageSources(question)
  const canFallBack = allowsSourcePageFallback(question)
  const figureSources = useFallback || !customImages.length
    ? canFallBack && question.sourcePageImage ? [question.sourcePageImage] : []
    : customImages

  if (!figureSources.length) return null

  const showingSourcePage = figureSources.every((source) => source === question.sourcePageImage || source.includes('/question-pages/'))

  return (
    <figure className={showingSourcePage ? 'source-figure source-page' : 'source-figure question-crop'}>
      {figureSources.map((source, index) => (
        <img
          src={source}
          alt={`官方圖片 ${index + 1}：${question.id}`}
          key={source}
          onError={() => {
            if (canFallBack && question.sourcePageImage && !showingSourcePage) setUseFallback(true)
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
  hasReviewCard,
  onAddReviewCard,
}: Props) {
  const [guessed, setGuessed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  // Live AI is a private feature; without a configured token the AI buttons hide
  // entirely instead of dead-ending in a "connect first" error.
  const aiEnabled = !!localStorage.getItem('level-b-ai-access-token')
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
  const explainRequestRef = useRef(0)
  const readingRequestRef = useRef(0)
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
      optionCodeBlocks: question.optionCodeBlocks
        ? optionOrder.map((value) => question.optionCodeBlocks?.[value - 1] ?? null)
        : undefined,
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
    explainRequestRef.current += 1
    readingRequestRef.current += 1
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
    const requestId = ++explainRequestRef.current
    const requestQuestionId = question.id
    const explainQuestion = isCommute ? question : (questionForScreenOrder ?? question)
    const explainSelected = isCommute || style === 'reading' ? selectedForExplain : toDisplayValues(selectedForExplain)
    setExplaining(true)
    setExplainError(null)
    try {
      const result = await onExplain(explainQuestion, explainSelected, style)
      if (explainRequestRef.current === requestId && questionId === requestQuestionId) {
        setExplanation(result)
      }
    } catch (reason) {
      if (explainRequestRef.current === requestId && questionId === requestQuestionId) {
        setExplainError(reason instanceof Error ? reason.message : 'Explanation is unavailable.')
      }
    } finally {
      if (explainRequestRef.current === requestId && questionId === requestQuestionId) {
        setExplaining(false)
      }
    }
  }, [isCommute, onExplain, question, questionForScreenOrder, questionId, selectedForExplain, toDisplayValues])

  useEffect(() => {
    if (!question || !answer || answer.correct || isFlashcard || (isMock && !showMockFeedback)) return
    if (!aiEnabled) return
    const selectedKey = [...selectedForExplain].sort((a, b) => a - b).join(',')
    const autoKey = `${question.id}::${selectedKey}`
    if (!selectedKey || autoExplainRef.current === autoKey) return
    autoExplainRef.current = autoKey
    void requestExplanation()
  }, [aiEnabled, answer, isFlashcard, isMock, question, requestExplanation, selectedForExplain, showMockFeedback])

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
      setExplainError('這則筆記是空的。請先重新產生，再播放。')
      return
    }
    if (!('speechSynthesis' in window)) {
      setExplainError('這個瀏覽器不支援語音播放。請用 Safari 或 Chrome 開啟。')
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
    const zhVoice = chooseChineseVoice(voices)
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
      utterance.rate = 0.98
      utterance.pitch = 1
      utterance.volume = 1
      if (zhVoice) utterance.voice = zhVoice
      utterance.onend = () => {
        index += 1
        window.setTimeout(speakNext, 320)
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

  // Some questions have image-only options. Keep the official option numbers
  // stable and render each crop directly inside its answer card when available.
  const optionsAreImages = usesImageOptionPlaceholders(question)
  const optionImages = optionImageSources(question)

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
    const requestId = ++readingRequestRef.current
    const requestQuestionId = question.id
    setReadingLoading(true)
    setReadingError(null)
    try {
      const result = await onExplain(isCommute ? question : (questionForScreenOrder ?? question), [], 'reading')
      if (readingRequestRef.current === requestId && questionId === requestQuestionId) {
        setReading(result)
      }
    } catch (reason) {
      if (readingRequestRef.current === requestId && questionId === requestQuestionId) {
        setReadingError(reason instanceof Error ? reason.message : 'Reading help is unavailable.')
      }
    } finally {
      if (readingRequestRef.current === requestId && questionId === requestQuestionId) {
        setReadingLoading(false)
      }
    }
  }

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="icon-button" onClick={onExit} aria-label={zhTW.practiceView.exitAria} type="button"><ArrowLeft size={21} /></button>
        <div className="practice-title">
          <strong>{session.title}</strong>
          <span>{zhTW.practiceView.positionOf(session.currentIndex + 1, session.questionIds.length)}</span>
        </div>
        <div className={isMock && secondsRemaining < 600 ? 'session-clock urgent' : 'session-clock'}>
          <Clock3 size={15} /> {formatClock(secondsRemaining)}
        </div>
      </header>
      <div className="practice-progress"><span style={{ width: `${progressPercent}%` }} /></div>

      {isMock ? (
        <div className="mock-toolbar">
          <button className={isFlagged ? 'flag-btn flagged' : 'flag-btn'} onClick={() => onToggleFlag(question.id)} type="button">
            <Flag size={15} fill={isFlagged ? 'currentColor' : 'none'} /> {isFlagged ? zhTW.practiceView.flagged : zhTW.practiceView.flag}
          </button>
          <span className="mock-count">{zhTW.practiceView.answeredCount(answeredCount, total)}{flaggedIndexes.length ? zhTW.practiceView.flaggedCount(flaggedIndexes.length) : ''}</span>
          <button className="nav-open" onClick={() => setNavOpen(true)} type="button"><LayoutGrid size={15} /> {zhTW.practiceView.navigator}</button>
        </div>
      ) : null}

      <section className="question-stage">
        <div className="question-meta">
          <span>{question.id}</span>
          <span>{question.sectionTitle}</span>
          <span>{question.kind === 'multiple' ? zhTW.practiceView.multiple : zhTW.practiceView.single}</span>
          <button className={progress[question.id]?.bookmarked ? 'saved' : ''} onClick={() => void onToggleBookmark(question.id)} aria-label={zhTW.practiceView.bookmarkAria} type="button">
            <Bookmark size={18} fill={progress[question.id]?.bookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <h1>{question.prompt}</h1>

        {question.codeBlock ? <CodeBlock code={question.codeBlock} /> : null}

        <QuestionFigure question={question} />

        {optionsAreImages ? (
          <p className="figure-note"><ImageIcon size={15} /> 圖片選項已放在下方各選項內；請依官方 1、2、3、4 作答。</p>
        ) : null}

        {isCommute ? (
          <section className="commute-card">
              <p className="answer-label">{aiCommuteNote ? 'AI 通勤筆記' : '基本通勤筆記'}</p>
              <div className="answer-summary">
                <span><strong>上次選擇：</strong>{priorSelection.length ? priorSelection.join('、') : '—'}</span>
                <span className="official"><strong>正確答案：</strong>{question.answers.join('、')}</span>
              </div>
              {playableExplanation ? (
                <div className="ai-explanation commute-note commute-transcript">{renderExplanation(playableExplanation)}</div>
              ) : null}
            <div className="commute-reference">
              <p className="answer-label">選項參考</p>
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
              {aiEnabled ? (
                <button className="secondary-action" disabled={explaining} onClick={() => void requestExplanation('commute')} type="button"><BrainCircuit size={18} /> {aiCommuteNote ? 'Regenerate AI' : 'Upgrade with AI'}</button>
              ) : null}
            </div>
          </section>
        ) : null}

        {!isFlashcard && !isCommute && aiEnabled ? (
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
              <button className="primary-action" onClick={() => setRevealed(true)} type="button"><Lightbulb size={19} /> {zhTW.practiceView.revealAnswer}</button>
            ) : (
              <>
                <p className="answer-label">{zhTW.practiceView.correctAnswerLabel}</p>
                <div className="revealed-options">
                  {question.answers.map((value) => <span key={value}>{formatDisplayChoices([value])}. {question.options[value - 1]}</span>)}
                </div>
                {aiEnabled ? (
                  <button className="explain-button flashcard-cue" disabled={explaining} onClick={() => void requestExplanation('cue')} type="button">
                    <BrainCircuit size={18} /> {explaining ? 'Writing mind note…' : 'Mind note'}
                  </button>
                ) : null}
                {explanation ? <div className="ai-explanation">{renderExplanation(explanation)}</div> : null}
                {explainError ? <p className="inline-error">{explainError}</p> : null}
                {!answer ? (
                  <div className="grade-actions">
                    <button onClick={() => void onFlashcardGrade(question, false)} type="button"><RotateCcw size={18} /> {zhTW.practiceView.needReview}</button>
                    <button className="success" onClick={() => void onFlashcardGrade(question, true)} type="button"><Check size={18} /> {zhTW.practiceView.knewIt}</button>
                  </div>
                ) : <button className="primary-action" onClick={next} type="button">{isLast ? zhTW.practiceView.finishCards : zhTW.practiceView.nextCard} <ChevronRight size={18} /></button>}
              </>
            )}
          </div>
        ) : !isCommute ? (
          <div className={`option-list ${question.kind}`}>
            {question.kind === 'multiple' ? (
              <p className="kind-hint"><CheckSquare size={15} /> {zhTW.practiceView.multipleHint}</p>
            ) : null}
            {optionOrder.map((value, index) => {
              const option = question.options[value - 1]
              const optionCode = question.optionCodeBlocks?.[value - 1]
              const optionImage = optionImages[value - 1]
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
                  <span className="opt-text">
                    {optionCode ? (
                      <CodeBlock code={optionCode} compact />
                    ) : optionImage ? (
                      <img className="option-image" src={optionImage} alt={`圖示選項 ${displayValue}`} />
                    ) : option}
                  </span>
                  {isCorrectChoice ? <Check size={18} /> : isWrongChoice ? <X size={18} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}

        {!isFlashcard && !isCommute && !answer && !isMock ? (
          <label className="guess-toggle">
            <input checked={guessed} onChange={(event) => setGuessed(event.target.checked)} type="checkbox" />
            <span><Flag size={16} /> {zhTW.practiceView.guessToggle}</span>
          </label>
        ) : null}

        {!isFlashcard && !isCommute && answer && (!isMock || showMockFeedback) ? (
          <section className={answer.correct ? 'feedback correct' : 'feedback wrong'}>
            <div>
              {answer.correct ? <Check size={20} /> : <X size={20} />}
              <strong>{answer.correct ? (answer.guessed ? zhTW.practiceView.feedbackCorrectGuessed : zhTW.practiceView.feedbackCorrect) : zhTW.practiceView.feedbackWrong}</strong>
            </div>
            <p>{answer.correct
              ? (answer.guessed
                ? zhTW.practiceView.guessedNote
                : ((progress[question.id]?.streak ?? 0) >= 2 ? zhTW.practiceView.masteredNote : zhTW.practiceView.oneMoreNote))
              : zhTW.practiceView.seeAgainNote}</p>
            <div className="answer-summary">
              <span><strong>{zhTW.practiceView.youChose}：</strong> {selected.length ? formatDisplayChoices(selected) : '—'}</span>
              <span className="official"><strong>{zhTW.practiceView.officialCorrect}：</strong> {formatDisplayChoices(question.answers)}</span>
              {priorSelection.length && JSON.stringify([...priorSelection].sort()) !== JSON.stringify([...selected].sort())
                ? <span className="earlier"><strong>{zhTW.practiceView.earlierChose}：</strong> {formatDisplayChoices(priorSelection)}</span>
                : null}
            </div>
            <button className="explain-button" disabled={hasReviewCard(question.id)} onClick={() => void onAddReviewCard(question)} type="button">
              <Layers3 size={18} /> {hasReviewCard(question.id) ? zhTW.review.addedToReview : zhTW.review.addToReview}
            </button>
            {aiEnabled ? (
              <button className="explain-button" disabled={explaining} onClick={() => void requestExplanation()} type="button">
                <BrainCircuit size={18} /> {explaining ? 'Writing short explanation…' : 'Ask AI about my choice'}
              </button>
            ) : null}
            {explanation ? <div className="ai-explanation">{renderExplanation(explanation)}</div> : null}
            {explanation && aiEnabled ? (
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
        <button className="secondary-action" disabled={session.currentIndex === 0} onClick={() => onNavigate(session.currentIndex - 1)} type="button"><ChevronLeft size={19} /> {zhTW.practiceView.previous}</button>
        {question.kind === 'multiple' && !answer && !isFlashcard && !isCommute ? (
          <span className="select-count">{zhTW.practiceView.selectedCount(selected.length)}</span>
        ) : null}
        {isMock ? (
          showMockFeedback
            ? (!answer
                ? <button className="primary-action" disabled={!selected.length} onClick={() => void submit()} type="button">{zhTW.practiceView.checkAnswer} <ChevronRight size={19} /></button>
                : isLast
                  ? <button className="primary-action" onClick={() => setReviewOpen(true)} type="button">{zhTW.practiceView.reviewSubmit} <ChevronRight size={19} /></button>
                  : <button className="primary-action" onClick={() => onNavigate(session.currentIndex + 1)} type="button">{zhTW.practiceView.next} <ChevronRight size={19} /></button>)
            : isLast
              ? <button className="primary-action" onClick={() => setReviewOpen(true)} type="button">{zhTW.practiceView.reviewSubmit} <ChevronRight size={19} /></button>
              : <button className="primary-action" onClick={() => onNavigate(session.currentIndex + 1)} type="button">{zhTW.practiceView.next} <ChevronRight size={19} /></button>
        ) : isCommute ? (
          <button className="primary-action" onClick={next} type="button">{isLast ? zhTW.practiceView.finishNotes : zhTW.practiceView.nextNote} <ChevronRight size={19} /></button>
        ) : !isFlashcard && !answer ? (
          <button className="primary-action" disabled={!selected.length} onClick={() => void submit()} type="button">{zhTW.practiceView.checkAnswer} <ChevronRight size={19} /></button>
        ) : !isFlashcard ? (
          <button className="primary-action" onClick={next} type="button">{isLast ? zhTW.practiceView.finishSession : zhTW.practiceView.next} <ChevronRight size={19} /></button>
        ) : <span />}
      </footer>

      {isMock && navOpen ? (
        <div className="mock-overlay" onClick={() => setNavOpen(false)}>
          <div className="mock-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head"><h2>{zhTW.practiceView.questionsSheet}</h2><button className="icon-button" onClick={() => setNavOpen(false)} aria-label={zhTW.practiceView.closeAria} type="button"><X size={20} /></button></div>
            <div className="nav-legend">
              <span><i className="dot current" /> {zhTW.practiceView.legendCurrent}</span>
              <span><i className="dot answered" /> {zhTW.practiceView.legendAnswered}</span>
              <span><i className="dot" /> {zhTW.practiceView.legendUnanswered}</span>
              <span><i className="dot flagged" /> {zhTW.practiceView.legendFlagged}</span>
            </div>
            <div className="nav-grid">
              {session.questionIds.map((id, index) => {
                const cls = ['nav-cell', index === session.currentIndex ? 'current' : '', session.selections[id]?.length ? 'answered' : '', flags[id] ? 'flagged' : ''].filter(Boolean).join(' ')
                return <button className={cls} key={id} onClick={() => { onNavigate(index); setNavOpen(false) }} type="button">{index + 1}</button>
              })}
            </div>
            <button className="primary-action" onClick={() => { setNavOpen(false); setReviewOpen(true) }} type="button">{zhTW.practiceView.reviewSubmit}</button>
          </div>
        </div>
      ) : null}

      {isMock && reviewOpen ? (
        <div className="mock-overlay" onClick={() => setReviewOpen(false)}>
          <div className="mock-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head"><h2>{zhTW.practiceView.submitMockTitle}</h2><button className="icon-button" onClick={() => setReviewOpen(false)} aria-label={zhTW.practiceView.closeAria} type="button"><X size={20} /></button></div>
            <p className="review-summary">{zhTW.practiceView.reviewSummary(answeredCount, total)}{flaggedIndexes.length ? zhTW.practiceView.flaggedCount(flaggedIndexes.length) : ''}</p>
            {unansweredIndexes.length ? (
              <div className="review-block">
                <p className="review-label warn"><AlertTriangle size={15} /> {zhTW.practiceView.unansweredJump(unansweredIndexes.length)}</p>
                <div className="chip-row">{unansweredIndexes.map((index) => <button className="chip" key={index} onClick={() => { onNavigate(index); setReviewOpen(false) }} type="button">{index + 1}</button>)}</div>
              </div>
            ) : <p className="review-label ok"><Check size={15} /> {zhTW.practiceView.allAnswered}</p>}
            {flaggedIndexes.length ? (
              <div className="review-block">
                <p className="review-label"><Flag size={15} /> {zhTW.practiceView.flaggedJump}</p>
                <div className="chip-row">{flaggedIndexes.map((index) => <button className="chip" key={index} onClick={() => { onNavigate(index); setReviewOpen(false) }} type="button">{index + 1}</button>)}</div>
              </div>
            ) : null}
            <div className="review-actions">
              <button className="secondary-action" onClick={() => setReviewOpen(false)} type="button">{zhTW.practiceView.keepReviewing}</button>
              <button className="primary-action" onClick={onComplete} type="button">{zhTW.practiceView.submitMock}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
