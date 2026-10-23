import { ArrowRight, CalendarClock, Check, CloudOff, Flame, Layers3, ListRestart, Sparkles } from 'lucide-react'
import type { DailyMissionView, MissionItemView } from '../../domain/dailyMission'
import { zhTW } from '../../i18n/zh-TW'
import { isSyncEnabled } from '../../storage/sync'
import { daysUntilExam, getExamDate } from '../examCountdown'
import { getRegistrationNotice, NATIONAL_EXAM_SCHEDULE_SOURCE } from '../nationalExamSchedule'
import { useActiveExam } from '../useActiveExam'

interface Props {
  seen: number
  total: number
  due: number
  accuracy: number
  hasSession: boolean
  remaining: number
  sessionLabel?: string
  streak: number
  mission: DailyMissionView
  onGoReview: () => void
  onWrongFix: () => void
  onContinue: () => void
  onSequential: () => void
  onOpenSettings: () => void
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
  return <button className={item.done ? 'mission-row done' : 'mission-row'} disabled={item.done} onClick={onGo} type="button"><span className="mission-icon"><Icon size={17} /></span><span className="mission-label">{meta.label()}</span><span className="mission-count">{item.done ? <Check size={16} /> : zhTW.home.missionProgress(item.completed, item.target)}</span></button>
}

export function HomePage(props: Props) {
  const { activeExam } = useActiveExam()
  const completion = props.total ? Math.round(props.seen / props.total * 100) : 0
  const examDays = daysUntilExam(getExamDate(), new Date())
  const registration = getRegistrationNotice(new Date())
  const showBackupNudge = !isSyncEnabled() && props.seen >= 20
  return <main className="page dashboard-page study-home">
    <header className="app-header">
      <div><p className="eyebrow">今天，也往前一點。</p><h1>{props.hasSession ? '接著上次，繼續練。' : props.seen ? '每一小步，都算數。' : '今天，先從十題開始。'}</h1><p className="header-subtitle">{props.hasSession ? '不用一次讀完，今天先把這組完成。' : '寫錯沒關係，我們會幫你記下來。'}</p></div>
    </header>
    <section className="study-next" aria-label="今日練習">
      <div className="study-next-meta"><span>今日練習</span>{props.streak > 0 ? <span><Flame size={14} />{zhTW.home.streak(props.streak)}</span> : <span>一次 10 題</span>}</div>
      <h2>{props.hasSession ? props.remaining > 0 ? `這一組，還有 ${props.remaining} 題。` : '這一組，可以收尾了。' : props.seen ? '今天，再練一組。' : '你的第一組 10 題。'}</h2>
      <p>{props.hasSession ? `${props.sessionLabel ?? '練習'} · 已完成的都幫你記著。` : '依題庫順序練習，照自己的步調前進。'}</p>
      <button onClick={props.hasSession ? props.onContinue : props.onSequential} type="button">{props.hasSession ? '繼續練習' : '開始今天的 10 題'}<ArrowRight size={19} /></button>
    </section>
    {props.seen > 0 ? <>
      <section className="readiness-strip" aria-label="學習概況"><div><span>已練題目</span><strong>{props.seen}</strong></div><div><span>本考科正確率</span><strong>{props.accuracy}%</strong></div><div><span>待複習</span><strong>{props.due} 題</strong></div></section>
      <section className="coverage-block"><div className="section-heading"><h2>每一小步，都算數。</h2><span>{completion}%</span></div><div className="progress-track" role="progressbar" aria-label="題庫練習進度" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completion}%` }} /></div><p className="study-local-note">已練 {props.seen} / {props.total} 題，不必急著把進度條填滿。</p></section>
      <details className="study-missions"><summary>{props.mission.allDone ? '今天的練習目標已完成' : '今天還可以練什麼？'}</summary><div className="mission-rows">{props.mission.items.map(item => <MissionRow item={item} key={item.type} onGo={item.type === 'due-review' ? props.onGoReview : item.type === 'wrong-fix' ? props.onWrongFix : props.onSequential} />)}</div></details>
    </> : null}
    <div className="study-date"><div><strong>{examDays === null ? '考試日期，由你決定' : examDays === 0 ? '今天是你設定的考試日' : `距離你的考試還有 ${examDays} 天`}</strong><p>{examDays === null ? '設定後，首頁會顯示你的倒數。' : `目標日期：${getExamDate()}`}</p></div><button type="button" onClick={props.onOpenSettings}>{examDays === null ? '設定' : '修改'}</button></div>
    {registration ? <p className={registration.urgent ? 'reg-nudge urgent' : 'reg-nudge'}><CalendarClock size={16} /><span>{registration.phase === 'upcoming' ? zhTW.home.regUpcoming(registration.entry.label, registration.daysRemaining, registration.entry.registrationStart) : registration.daysRemaining === 0 ? zhTW.home.regOpenToday(registration.entry.label) : zhTW.home.regOpen(registration.entry.label, registration.daysRemaining)}</span><a href={activeExam.officialLinks?.registration ?? NATIONAL_EXAM_SCHEDULE_SOURCE} rel="noreferrer" target="_blank">{zhTW.home.regAction}</a></p> : null}
    {showBackupNudge ? <p className="sync-nudge"><CloudOff size={16} /><span>{zhTW.home.syncOff(props.seen)}</span><button onClick={props.onOpenSettings} type="button">{zhTW.home.syncOffAction}</button></p> : null}
    <p className="study-local-note">進度保存在這台裝置。</p>
  </main>
}
