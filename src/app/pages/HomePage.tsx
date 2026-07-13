import { ArrowRight, Check, Clock3, CloudOff, Flame, Layers3, ListRestart, Sparkles } from 'lucide-react'
import type { DailyMissionView, MissionItemView } from '../../domain/dailyMission'
import { zhTW } from '../../i18n/zh-TW'
import { isSyncEnabled } from '../../storage/sync'
import { formatCurrentBankLabel } from '../activeExam'
import { daysUntilExam, getExamDate } from '../examCountdown'
import { useActiveExam } from '../useActiveExam'

interface Props {
  seen: number
  total: number
  due: number
  accuracy: number
  hasSession: boolean
  sessionLabel?: string
  streak: number
  mission: DailyMissionView
  onGoReview: () => void
  onWrongFix: () => void
  onContinue: () => void
  onSequential: () => void
}

const MISSION_META = {
  'due-review': { label: () => zhTW.home.missionDueReview, icon: Layers3 },
  'wrong-fix': { label: () => zhTW.home.missionWrongFix, icon: ListRestart },
  'fresh-questions': { label: () => zhTW.home.missionFresh, icon: Sparkles },
} as const

function MissionRow({ item, onGo }: { item: MissionItemView; onGo: () => void }) {
  const meta = MISSION_META[item.type as keyof typeof MISSION_META]
  if (!meta || item.target === 0) return null
  const Icon = meta.icon
  return (
    <button className={item.done ? 'mission-row done' : 'mission-row'} disabled={item.done} onClick={onGo} type="button">
      <span className="mission-icon"><Icon size={17} /></span>
      <span className="mission-label">{meta.label()}</span>
      <span className="mission-count">{item.done ? <Check size={16} /> : zhTW.home.missionProgress(item.completed, item.target)}</span>
    </button>
  )
}

export function HomePage(props: Props) {
  const { activeExam } = useActiveExam()
  const completion = props.total ? Math.round((props.seen / props.total) * 100) : 0
  const primaryLabel = props.hasSession ? props.sessionLabel : zhTW.home.continueFrom
  // Null when no date is set or it has already passed — the countdown hides
  // itself rather than showing a stale/negative number in either case.
  const examDays = daysUntilExam(getExamDate(), new Date())

  return (
    <main className="page dashboard-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">{zhTW.home.currentBank}：{formatCurrentBankLabel(activeExam)}</p>
          <h1>Level Up</h1>
          <p className="header-subtitle">{zhTW.home.subtitle}</p>
        </div>
        {examDays !== null ? (
          <div className="exam-countdown" aria-label={examDays === 0 ? zhTW.home.examTodayAria : zhTW.home.examDaysAria(examDays)}>
            <strong>{examDays === 0 ? zhTW.home.examTodayBig : examDays}</strong>
            <span>{examDays === 0 ? zhTW.home.examTodaySmall : zhTW.home.examDaysUnit}</span>
          </div>
        ) : null}
      </header>

      {!isSyncEnabled() ? (
        <p className="sync-nudge"><CloudOff size={16} /> {zhTW.home.syncOff}</p>
      ) : null}

      <section className="mission-card" aria-label={zhTW.home.missionTitle}>
        <div className="mission-head">
          <p className="eyebrow">{zhTW.home.missionTitle}</p>
          {props.streak > 0 ? (
            <span className="streak-chip"><Flame size={14} /> {zhTW.home.streak(props.streak)}</span>
          ) : null}
        </div>
        {props.mission.allDone ? (
          <p className="mission-all-done"><Sparkles size={17} /> {zhTW.home.missionAllDone}</p>
        ) : null}
        <div className="mission-rows">
          {props.mission.items.map((item) => (
            <MissionRow
              item={item}
              key={item.type}
              onGo={item.type === 'due-review' ? props.onGoReview : item.type === 'wrong-fix' ? props.onWrongFix : props.onSequential}
            />
          ))}
        </div>
      </section>

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
