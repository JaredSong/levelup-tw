import { ArrowRight, Clock3, CloudOff, Flame } from 'lucide-react'
import { zhTW } from '../../i18n/zh-TW'
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
  const primaryLabel = props.hasSession ? props.sessionLabel : zhTW.home.continueFrom

  return (
    <main className="page dashboard-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">{zhTW.home.currentBank}：網頁設計乙級 A13</p>
          <h1>Level Up</h1>
          <p className="header-subtitle">{zhTW.home.subtitle}</p>
        </div>
        <div className="exam-countdown" aria-label={`${daysUntilExam()} days until written exam`}>
          <strong>{daysUntilExam()}</strong>
          <span>days</span>
        </div>
      </header>

      {!isSyncEnabled() ? (
        <p className="sync-nudge"><CloudOff size={16} /> {zhTW.home.syncOff}</p>
      ) : null}

      <section className="readiness-strip" aria-label="Study overview">
        <div>
          <span>{zhTW.home.seen}</span>
          <strong>{props.seen}</strong>
        </div>
        <div>
          <span>{zhTW.home.dueNow}</span>
          <strong>{props.due}</strong>
        </div>
        <div>
          <span>{zhTW.home.accuracy}</span>
          <strong>{props.accuracy}%</strong>
        </div>
      </section>

      <button className="continue-panel" onClick={props.hasSession ? props.onContinue : props.onSequential} type="button">
        <span className="continue-icon"><ArrowRight size={23} strokeWidth={2} /></span>
        <span className="continue-copy">
          <span className="action-kicker">{zhTW.home.nextStep}</span>
          <strong>{primaryLabel}</strong>
          <span>{props.hasSession ? zhTW.home.exactPositionSaved : zhTW.home.startSmallFreshSet}</span>
        </span>
        <ArrowRight className="continue-arrow" size={22} strokeWidth={1.8} />
      </button>

      <section className="coverage-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{zhTW.home.coverage}</p>
            <h2>{zhTW.home.recorded(props.seen, props.total)}</h2>
          </div>
          <span>{completion}%</span>
        </div>
        <div className="progress-track" aria-label={`${completion}% complete`}>
          <span style={{ width: `${completion}%` }} />
        </div>
      </section>

      <aside className="today-note">
        <Clock3 size={18} />
        <p><strong>{zhTW.home.shortSessionTitle}</strong> {zhTW.home.shortSessionBody}</p>
        <Flame size={18} />
      </aside>
    </main>
  )
}
