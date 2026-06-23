import {
  ArrowLeft,
  Bookmark,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flag,
  Lightbulb,
  RotateCcw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  onComplete: () => void
  onExplain: (question: Question, selected: number[], style?: string) => Promise<string>
}

function formatClock(totalSeconds: number) {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60))
  const seconds = Math.max(0, totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
  onComplete,
  onExplain,
}: Props) {
  const [guessed, setGuessed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)

  const questionId = session.questionIds[session.currentIndex]
  const question = questions.get(questionId)
  const selected = session.selections[questionId] ?? []
  const answer = session.answers[questionId]
  const isMock = session.mode === 'mock'
  const isFlashcard = session.mode === 'flashcard'
  const isLast = session.currentIndex === session.questionIds.length - 1

  useEffect(() => {
    setGuessed(false)
    setRevealed(false)
    setExplanation(null)
    setExplainError(null)
  }, [questionId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const secondsRemaining = session.mockEndsAt
    ? Math.ceil((new Date(session.mockEndsAt).getTime() - now) / 1000)
    : Math.floor((now - new Date(session.startedAt).getTime()) / 1000)

  const progressPercent = Math.round(((session.currentIndex + 1) / session.questionIds.length) * 100)
  const correctChoices = useMemo(() => new Set(question?.answers ?? []), [question])

  if (!question) return null

  const toggleOption = (option: number) => {
    if (answer || isFlashcard) return
    if (question.kind === 'single') onSelect(question.id, [option])
    else onSelect(question.id, selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])
  }

  const submit = async () => {
    if (!selected.length || answer) return
    await onSubmit(question, selected, guessed)
    if (isMock && !isLast) onNavigate(session.currentIndex + 1)
  }

  const next = () => {
    if (isLast) onComplete()
    else onNavigate(session.currentIndex + 1)
  }

  const requestExplanation = async (style = 'default') => {
    setExplaining(true)
    setExplainError(null)
    try {
      setExplanation(await onExplain(question, selected, style))
    } catch (reason) {
      setExplainError(reason instanceof Error ? reason.message : 'Explanation is unavailable.')
    } finally {
      setExplaining(false)
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

        {question.sourceImage ? (
          <details className="source-figure">
            <summary><ExternalLink size={17} /> Open the official figure page</summary>
            <img src={question.sourceImage} alt={`Official source page ${question.sourcePage} for ${question.id}`} />
          </details>
        ) : null}

        {isFlashcard ? (
          <div className="flashcard-answer">
            {!revealed && !answer ? (
              <button className="primary-action" onClick={() => setRevealed(true)} type="button"><Lightbulb size={19} /> Reveal answer</button>
            ) : (
              <>
                <p className="answer-label">Correct answer</p>
                <div className="revealed-options">
                  {question.answers.map((value) => <span key={value}>{value}. {question.options[value - 1]}</span>)}
                </div>
                {!answer ? (
                  <div className="grade-actions">
                    <button onClick={() => void onFlashcardGrade(question, false)} type="button"><RotateCcw size={18} /> Need review</button>
                    <button className="success" onClick={() => void onFlashcardGrade(question, true)} type="button"><Check size={18} /> Knew it</button>
                  </div>
                ) : <button className="primary-action" onClick={next} type="button">{isLast ? 'Finish session' : 'Next card'} <ChevronRight size={18} /></button>}
              </>
            )}
          </div>
        ) : (
          <div className="option-list">
            {question.options.map((option, index) => {
              const value = index + 1
              const isSelected = selected.includes(value)
              const isCorrectChoice = !!answer && correctChoices.has(value)
              const isWrongChoice = !!answer && isSelected && !isCorrectChoice
              const classes = [isSelected ? 'selected' : '', isCorrectChoice ? 'correct' : '', isWrongChoice ? 'wrong' : ''].filter(Boolean).join(' ')
              return (
                <button className={classes} key={value} onClick={() => toggleOption(value)} type="button">
                  <span className="option-index">{value}</span>
                  <span>{option}</span>
                  {isCorrectChoice ? <Check size={18} /> : isWrongChoice ? <X size={18} /> : null}
                </button>
              )
            })}
          </div>
        )}

        {!isFlashcard && !answer && !isMock ? (
          <label className="guess-toggle">
            <input checked={guessed} onChange={(event) => setGuessed(event.target.checked)} type="checkbox" />
            <span><Flag size={16} /> I am guessing; keep this in review even if correct.</span>
          </label>
        ) : null}

        {!isFlashcard && answer && !isMock ? (
          <section className={answer.correct ? 'feedback correct' : 'feedback wrong'}>
            <div>
              {answer.correct ? <Check size={20} /> : <X size={20} />}
              <strong>{answer.correct ? (answer.guessed ? 'Correct, but still learning' : 'Correct') : 'Not yet'}</strong>
            </div>
            <p>{answer.correct ? 'This item has been scheduled according to your recall.' : 'You will see this item again soon.'}</p>
            <button className="explain-button" disabled={explaining} onClick={() => void requestExplanation()} type="button">
              <BrainCircuit size={18} /> {explaining ? 'Explaining…' : 'Explain this question'}
            </button>
            {explanation ? <div className="ai-explanation">{explanation}</div> : null}
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
        {!isFlashcard && !answer ? (
          <button className="primary-action" disabled={!selected.length} onClick={() => void submit()} type="button">{isMock ? (isLast ? 'Submit mock' : 'Save & next') : 'Check answer'} <ChevronRight size={19} /></button>
        ) : !isFlashcard ? (
          <button className="primary-action" onClick={next} type="button">{isLast ? 'Finish session' : 'Next'} <ChevronRight size={19} /></button>
        ) : <span />}
      </footer>
    </main>
  )
}
