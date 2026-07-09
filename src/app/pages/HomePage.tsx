import { ArrowRight, Clock3, CloudOff, Flame } from 'lucide-react'
import { isSyncEnabled } from '../../storage/sync'

interface Props {
  seen: number
  total: number
  due: number
  accuracy: number
  hasSession: boolean
  sessionLabel?: string
  onContinue: () => void
  onSequential: () => void
}

function daysUntilExam() {
  const now = new Date()
  const exam = new Date('2026-07-05T14:00:00+08:00')
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000))
}

export function HomePage(props: Props) {
  const completion = props.total ? Math.round((props.seen / props.total) * 100) : 0
  const primaryLabel = props.hasSession ? props.sessionLabel : 'Continue from question 145'

  return (
    <main className="page dashboard-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">目前題庫：網頁設計乙級 A13</p>
          <h1>Level Up</h1>
          <p className="header-subtitle">升級吧 · 今日任務</p>
        </div>
        <div className="exam-countdown" aria-label={`${daysUntilExam()} days until written exam`}>
          <strong>{daysUntilExam()}</strong>
          <span>days</span>
        </div>
      </header>

      {!isSyncEnabled() ? (
        <p className="sync-nudge"><CloudOff size={16} /> Cloud sync is off — set a passphrase in Insights so your progress is saved across devices.</p>
      ) : null}

      <section className="readiness-strip" aria-label="Study overview">
        <div>
          <span>Seen</span>
          <strong>{props.seen}</strong>
        </div>
        <div>
          <span>Due now</span>
          <strong>{props.due}</strong>
        </div>
        <div>
          <span>Accuracy</span>
          <strong>{props.accuracy}%</strong>
        </div>
      </section>

      <button className="continue-panel" onClick={props.hasSession ? props.onContinue : props.onSequential} type="button">
        <span className="continue-icon"><ArrowRight size={23} strokeWidth={2} /></span>
        <span className="continue-copy">
          <span className="action-kicker">Next useful step</span>
          <strong>{primaryLabel}</strong>
          <span>{props.hasSession ? 'Your exact position is saved.' : 'Start with a small fresh set.'}</span>
        </span>
        <ArrowRight className="continue-arrow" size={22} strokeWidth={1.8} />
      </button>

      <section className="coverage-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Coverage</p>
            <h2>{props.seen} of {props.total} recorded</h2>
          </div>
          <span>{completion}%</span>
        </div>
        <div className="progress-track" aria-label={`${completion}% complete`}>
          <span style={{ width: `${completion}%` }} />
        </div>
      </section>

      <aside className="today-note">
        <Clock3 size={18} />
        <p><strong>Short session is enough.</strong> Clear due review, then do a small fresh set or one mock when you have room.</p>
        <Flame size={18} />
      </aside>
    </main>
  )
}
