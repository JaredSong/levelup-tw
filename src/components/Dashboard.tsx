import {
  ArrowRight,
  Brain,
  Clock3,
  CloudOff,
  Flame,
  Layers3,
  ListRestart,
  Shuffle,
  Timer,
  Zap,
} from 'lucide-react'
import { isSyncEnabled } from '../storage/sync'

interface Props {
  seen: number
  total: number
  due: number
  wrongCount: number
  accuracy: number
  hasSession: boolean
  sessionLabel?: string
  onContinue: () => void
  onSequential: () => void
  onAdaptive: () => void
  onRandom: () => void
  onSubject: (subjectCode: string, title: string) => void
  onWrong: () => void
  onFlashcards: () => void
  onMock: () => void
  onSprint: () => void
}

function daysUntilExam() {
  const now = new Date()
  const exam = new Date('2026-07-05T14:00:00+08:00')
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000))
}

export function Dashboard(props: Props) {
  const completion = props.total ? Math.round((props.seen / props.total) * 100) : 0
  const primaryLabel = props.hasSession ? props.sessionLabel : 'Continue from question 145'

  return (
    <main className="page dashboard-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">17300 A13 · current shared banks</p>
          <h1>Level B Study</h1>
          <p className="header-subtitle">網頁設計乙級 · personal study bank</p>
        </div>
        <div className="exam-countdown" aria-label={`${daysUntilExam()} days until written exam`}>
          <strong>{daysUntilExam()}</strong>
          <span>days</span>
        </div>
      </header>

      {!isSyncEnabled() ? (
        <p className="sync-nudge"><CloudOff size={16} /> Cloud sync is off — set a passphrase in Stats so your progress is saved across devices.</p>
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

      <section className="syllabus-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Latest syllabus</p>
            <h2>All required banks included</h2>
          </div>
          <strong>1,365</strong>
        </div>
        <div className="syllabus-list">
          {[
            ['17300', 'Web design', '846 · A13'],
            ['90011', 'Information common', '119 · A10 · 5 groups'],
            ['90006', 'Safety & health', '100 · A18'],
            ['90007', 'Ethics & law', '100 · A17'],
            ['90008', 'Environmental protection', '100 · A16'],
            ['90009', 'Energy & carbon', '100 · A11'],
          ].map(([code, label, meta]) => (
            <button key={code} onClick={() => props.onSubject(code, `${label} · Random 10`)} type="button">
              <span>{code}</span><strong>{label}</strong><small>{meta}</small><ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <button className="continue-panel" onClick={props.hasSession ? props.onContinue : props.onSequential} type="button">
        <span className="continue-icon"><ArrowRight size={23} strokeWidth={2} /></span>
        <span className="continue-copy">
          <span className="action-kicker">Next useful step</span>
          <strong>{primaryLabel}</strong>
          <span>{props.hasSession ? 'Your exact position is saved.' : 'Your earlier 144 remain available for review.'}</span>
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

      <section className="mode-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Practice</p>
            <h2>Choose the kind of work</h2>
          </div>
        </div>
        <div className="mode-list">
          <button type="button" onClick={props.onSprint}>
            <span className="mode-icon coral"><Zap size={21} /></span>
            <span><strong>Exam sprint</strong><small>20 weighted to weak spots · for a short break</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onAdaptive}>
            <span className="mode-icon accent"><Brain size={21} /></span>
            <span><strong>Adaptive 10</strong><small>Due, wrong, weak, then new</small></span>
            <span className="mode-meta">10</span>
          </button>
          <button type="button" onClick={props.onWrong}>
            <span className="mode-icon coral"><ListRestart size={21} /></span>
            <span><strong>Wrong answers</strong><small>Stable queue, no jump back to item 1</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
          <button type="button" onClick={props.onRandom}>
            <span className="mode-icon blue"><Shuffle size={21} /></span>
            <span><strong>Random 10</strong><small>Mixed across all 13 syllabus groups</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onFlashcards}>
            <span className="mode-icon gold"><Layers3 size={21} /></span>
            <span><strong>Recall cards</strong><small>Reveal, then grade what you knew</small></span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="mock-band">
        <div className="mock-copy">
          <span className="mode-icon dark"><Timer size={22} /></span>
          <div>
            <p className="eyebrow">Official format</p>
            <h2>80-question mock</h2>
            <p>60 single · 20 multiple · four questions from each general subject</p>
          </div>
        </div>
        <button onClick={props.onMock} type="button">Start mock <ArrowRight size={17} /></button>
      </section>

      <aside className="today-note">
        <Clock3 size={18} />
        <p><strong>Short session is enough.</strong> Ten corrected items beat another hundred unreviewed ones.</p>
        <Flame size={18} />
      </aside>
    </main>
  )
}
