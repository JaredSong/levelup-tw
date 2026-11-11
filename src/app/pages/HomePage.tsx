import { ArrowRight, CalendarClock, CloudOff, Flame } from 'lucide-react'
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
  wrong: number
  activeDays: number
  hasSession: boolean
  remaining: number
  sessionLabel?: string
  streak: number
  onGoReview: () => void
  onWrongFix: () => void
  onContinue: () => void
  onSequential: () => void
  onOpenSettings: () => void
}

const RING_SIZE = 116
const RING_STROKE = 10

/** Coverage of the bank: how many questions have been answered at least once. */
function CoverageRing({ seen, total }: { seen: number; total: number }) {
  const percent = total ? Math.round(seen / total * 100) : 0
  const radius = RING_SIZE / 2 - RING_STROKE / 2 - 1
  const circumference = 2 * Math.PI * radius
  return <div className="home-ring" role="progressbar" aria-label="題庫練習進度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <svg aria-hidden="true" height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={RING_SIZE}>
      <circle className="home-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill="none" r={radius} strokeWidth={RING_STROKE} />
      <circle className="home-ring-fill" cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill="none" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} strokeLinecap="round" strokeWidth={RING_STROKE} />
    </svg>
    <div className="home-ring-value"><strong>{percent}%</strong><small>{seen.toLocaleString()} / {total.toLocaleString()}</small></div>
  </div>
}

function headline(props: Props, examDays: number | null) {
  if (props.hasSession) return { eyebrow: '接著上次', title: props.remaining > 0 ? `這一組，還有 ${props.remaining} 題。` : '這一組，可以收尾了。' }
  if (!props.seen) return { eyebrow: '歡迎', title: `題庫 ${props.total.toLocaleString()} 題，從 10 題開始。` }
  if (examDays !== null && examDays <= 14) return { eyebrow: '最後衝刺', title: '先把錯題和複習清掉。' }
  return { eyebrow: '你的進度', title: '穩穩往前，今天再一組。' }
}

export function HomePage(props: Props) {
  const { activeExam } = useActiveExam()
  const examDays = daysUntilExam(getExamDate(), new Date())
  const registration = getRegistrationNotice(new Date())
  const showBackupNudge = !isSyncEnabled() && props.seen >= 20
  const head = headline(props, examDays)
  return <main className="page dashboard-page study-home">
    <header className="home-head">
      <p className="eyebrow">{head.eyebrow}</p>
      <h1>{head.title}</h1>
    </header>

    <section className="home-hero" aria-label="學習概況">
      <CoverageRing seen={props.seen} total={props.total} />
      {examDays === null
        ? <button className="home-countdown empty" onClick={props.onOpenSettings} type="button"><strong>考試哪一天？</strong><span>設定後這裡會倒數 →</span></button>
        : <button className="home-countdown" onClick={props.onOpenSettings} type="button"><strong>{examDays === 0 ? '今天' : `${examDays} 天`}</strong><span>{examDays === 0 ? '是你設定的考試日' : `距離考試 · ${getExamDate()}`}</span></button>}
    </section>

    <button className="home-primary" onClick={props.hasSession ? props.onContinue : props.onSequential} type="button">
      <span>{props.hasSession ? '繼續練習' : props.seen ? '開始今天的 10 題' : '開始第一組 10 題'}{props.hasSession && props.sessionLabel ? <small>{props.sessionLabel}</small> : null}</span>
      <ArrowRight size={19} />
    </button>

    {props.seen > 0
      ? <section className="home-tiles" aria-label="今天可以做的事">
        <button className="home-tile coral" disabled={!props.wrong} onClick={props.onWrongFix} type="button"><strong>{props.wrong}</strong><span>錯題待修正</span></button>
        <button className="home-tile gold" disabled={!props.due} onClick={props.onGoReview} type="button"><strong>{props.due}</strong><span>今天該複習</span></button>
        <div className="home-tile"><strong>{props.accuracy}%</strong><span>正確率</span></div>
        <div className="home-tile"><strong>{props.activeDays} 天</strong><span>近 7 天有練{props.streak > 1 ? <em><Flame size={12} />連續 {props.streak} 天</em> : null}</span></div>
      </section>
      : <p className="home-intro">寫錯的題目會自動收進錯題本，快忘的會排進複習。進度只存在這台裝置。</p>}

    {registration ? <p className={registration.urgent ? 'reg-nudge urgent' : 'reg-nudge'}><CalendarClock size={16} /><span>{registration.phase === 'upcoming' ? zhTW.home.regUpcoming(registration.entry.label, registration.daysRemaining, registration.entry.registrationStart) : registration.daysRemaining === 0 ? zhTW.home.regOpenToday(registration.entry.label) : zhTW.home.regOpen(registration.entry.label, registration.daysRemaining)}</span><a href={activeExam.officialLinks?.registration ?? NATIONAL_EXAM_SCHEDULE_SOURCE} rel="noreferrer" target="_blank">{zhTW.home.regAction}</a></p> : null}
    {showBackupNudge ? <p className="sync-nudge"><CloudOff size={16} /><span>{zhTW.home.syncOff(props.seen)}</span><button onClick={props.onOpenSettings} type="button">{zhTW.home.syncOffAction}</button></p> : null}
    {props.seen > 0 ? <p className="study-local-note">進度保存在這台裝置。</p> : null}
  </main>
}
