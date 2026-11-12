import { ArrowRight, CalendarClock, Check, ChevronRight, CloudOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DailyMissionView } from '../../domain/dailyMission'
import { localDayKey } from '../../domain/dailyMission'
import { homeTasks, lastOfficialMock, recentWeek, ringLabel, type HomeTask } from '../../domain/homePlan'
import { zhTW } from '../../i18n/zh-TW'
import { db, type SessionResult } from '../../storage/db'
import { isSyncEnabled } from '../../storage/sync'
import { daysUntilExam, getExamDate } from '../examCountdown'
import { getRegistrationNotice, NATIONAL_EXAM_SCHEDULE_SOURCE } from '../nationalExamSchedule'
import { useActiveExam } from '../useActiveExam'

interface Props {
  seen: number
  total: number
  hasSession: boolean
  remaining: number
  sessionLabel?: string
  mission: DailyMissionView
  activityTimestamps: string[]
  onGoMock: () => void
  onGoReview: () => void
  onWrongFix: () => void
  onContinue: () => void
  onSequential: () => void
  onOpenSettings: () => void
}

const RING_SIZE = 84
const RING_STROKE = 8

function CoverageRing({ seen, total }: { seen: number; total: number }) {
  const percent = total ? Math.round(seen / total * 100) : 0
  const radius = RING_SIZE / 2 - RING_STROKE / 2 - 1
  const circumference = 2 * Math.PI * radius
  const label = ringLabel(seen, total)
  return <div className="home-ring-wrap">
    <div className="home-ring" role="progressbar" aria-label="題庫練習進度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <svg aria-hidden="true" height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={RING_SIZE}>
        <circle className="home-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill="none" r={radius} strokeWidth={RING_STROKE} />
        <circle className="home-ring-fill" cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill="none" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} strokeLinecap="round" strokeWidth={RING_STROKE} />
      </svg>
      <strong className={label.long ? 'home-ring-value long' : 'home-ring-value'}>{label.text}</strong>
    </div>
    <small>{seen ? `已練 ${seen.toLocaleString()} 題` : '題可練'}</small>
  </div>
}

function useLastMock(examId: string) {
  const [last, setLast] = useState<SessionResult | null>(null)
  useEffect(() => {
    let live = true
    void db.results.where('examId').equals(examId).toArray()
      .then((rows) => { if (live) setLast(lastOfficialMock(rows, zhTW.session.trainingMock)) })
    return () => { live = false }
  }, [examId])
  return last
}

function headline(props: Props, examDays: number | null) {
  if (props.hasSession) return props.remaining > 0 ? `這一組，還有 ${props.remaining} 題。` : '這一組，可以收尾了。'
  if (!props.seen) return '今天，先從十題開始。'
  if (examDays !== null && examDays <= 14) return '最後衝刺，先補弱點。'
  return '穩穩往前，今天再一組。'
}

/** "2026-12-20" → "12/20": the year is obvious this close to the exam. */
function formatShortDate(iso: string | null): string {
  const match = iso?.match(/^\d{4}-(\d{2})-(\d{2})$/)
  return match ? `${Number(match[1])}/${Number(match[2])}` : iso ?? ''
}

interface TaskCopy { title: string; detail: string; action: string; go: () => void }

export function HomePage(props: Props) {
  const { activeExam } = useActiveExam()
  const now = new Date()
  const examDays = daysUntilExam(getExamDate(), now)
  const registration = getRegistrationNotice(now)
  const showBackupNudge = !isSyncEnabled() && props.seen >= 20
  const lastMock = useLastMock(activeExam.examId)
  const mockDoneToday = Boolean(lastMock && localDayKey(lastMock.finishedAt) === localDayKey(now))
  const week = recentWeek(props.activityTimestamps, now)
  const tasks = homeTasks({ mission: props.mission, seen: props.seen, examDays, mockDoneToday })
  const passScore = activeExam.mockRules.passScore

  const copy = (task: HomeTask): TaskCopy => {
    if (task.kind === 'fresh') {
      return props.seen
        ? { title: `練新題 ${task.target} 題`, detail: task.completed ? `今天已練 ${task.completed} 題` : `還有 ${(props.total - props.seen).toLocaleString()} 題沒練過`, action: '開始練習', go: props.onSequential }
        : { title: `練第一組 ${task.target} 題`, detail: '照題庫順序，寫錯的會自動記下來', action: `開始第一組 ${task.target} 題`, go: props.onSequential }
    }
    if (task.kind === 'review') return { title: `複習到期 ${task.target} 題`, detail: task.completed ? `今天已複習 ${task.completed} 題` : '快忘的先救回來', action: '開始複習', go: props.onGoReview }
    if (task.kind === 'wrong') return { title: `修正錯題 ${task.target} 題`, detail: task.completed ? `今天已修正 ${task.completed} 題` : '把錯過的再寫對一次', action: '開始修正', go: props.onWrongFix }
    return { title: '模擬考 1 次', detail: `${activeExam.mockRules.totalQuestions} 題・計時`, action: '開始模擬考', go: props.onGoMock }
  }
  const firstOpen = props.hasSession ? -1 : tasks.findIndex((task) => !task.done)

  return <main className="page dashboard-page study-home">
    <h1 className="home-title">{headline(props, examDays)}</h1>

    <button className={examDays === null ? 'home-banner ask' : 'home-banner'} onClick={props.onOpenSettings} type="button">
      <span className="home-banner-text">
        <span className="home-banner-key">{examDays === null ? '考試日期' : '距離考試'}</span>
        <strong>{examDays === null ? '哪天考試？' : examDays === 0 ? '今天' : `${examDays} 天`}</strong>
        <span className="home-banner-edit">{examDays === null ? '設定後這裡會倒數' : `目標 ${formatShortDate(getExamDate())} · 修改`}<ChevronRight size={13} /></span>
      </span>
      <CoverageRing seen={props.seen} total={props.total} />
    </button>

    {props.seen > 0
      ? <section className="home-week" aria-label="近 7 天練習">
        <div className="home-week-head"><p className="eyebrow">近 7 天</p><span>練了 {week.filter((day) => day.active).length} 天</span></div>
        <ol>{week.map((day) => <li className={[day.today ? 'today' : '', day.active ? 'active' : ''].filter(Boolean).join(' ') || undefined} key={day.key}><i aria-hidden="true" /><span>{day.label}</span><span className="visually-hidden">{day.active ? '有練習' : '沒有練習'}</span></li>)}</ol>
      </section>
      : <p className="home-intro">寫錯的題目會自動收進錯題本，快忘的會排進複習。</p>}

    <p className="eyebrow">{tasks.length > 1 ? `今天的 ${tasks.length} 件事` : '今天'}</p>
    <section className="home-tasks" aria-label="今天的練習">
      {props.hasSession ? <div className="home-task">
        <span className="home-task-check" aria-hidden="true" />
        <span><b>{props.sessionLabel ?? '上次的練習'}</b><small>{props.remaining > 0 ? `還有 ${props.remaining} 題` : '可以收尾了'}</small></span>
        <button className="home-task-primary" onClick={props.onContinue} type="button">繼續練習<ArrowRight size={18} /></button>
      </div> : null}
      {tasks.map((task, index) => {
        const text = copy(task)
        if (index === firstOpen) {
          return <div className="home-task" key={task.kind}>
            <span className="home-task-check" aria-hidden="true" />
            <span><b>{text.title}</b><small>{text.detail}</small></span>
            <button className="home-task-primary" onClick={text.go} type="button">{text.action}<ArrowRight size={18} /></button>
          </div>
        }
        return <button className={task.done ? 'home-task done' : 'home-task'} disabled={task.done} key={task.kind} onClick={text.go} type="button">
          <span className="home-task-check" aria-hidden="true">{task.done ? <Check size={13} strokeWidth={3} /> : null}</span>
          <span><b>{text.title}</b><small>{task.done ? '今天完成了' : text.detail}</small></span>
          {task.done ? null : <ChevronRight className="home-task-chevron" size={18} />}
        </button>
      })}
      {firstOpen === -1 && !props.hasSession ? <button className="home-task-more" onClick={props.onSequential} type="button">今天的都完成了，想再練就再來 10 題<ChevronRight size={16} /></button> : null}
    </section>

    {props.seen > 0
      ? lastMock
        ? <button className={lastMock.passed ? 'home-mock pass' : 'home-mock fail'} onClick={props.onGoMock} type="button">
          <span><small>上次模擬考 · {new Date(lastMock.finishedAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</small><b>{lastMock.passed ? '過關了，考前再做一次確認' : `還差 ${Math.ceil(passScore - lastMock.score)} 分，先補錯題再試`}</b></span>
          <span className="home-mock-score"><strong>{Number.isInteger(lastMock.score) ? lastMock.score : lastMock.score.toFixed(1)}<small> 分</small></strong><small>及格線 {passScore}</small></span>
        </button>
        // In the final stretch the mock is already one of today's tasks.
        : tasks.some((task) => task.kind === 'mock') ? null : <button className="home-mock empty" onClick={props.onGoMock} type="button">
          <span><small>模擬考</small><b>還沒做過，練到一半時試一次</b></span>
          <ChevronRight className="home-task-chevron" size={18} />
        </button>
      : null}

    {registration ? <p className={registration.urgent ? 'reg-nudge urgent' : 'reg-nudge'}><CalendarClock size={16} /><span>{registration.phase === 'upcoming' ? zhTW.home.regUpcoming(registration.entry.label, registration.daysRemaining, registration.entry.registrationStart) : registration.daysRemaining === 0 ? zhTW.home.regOpenToday(registration.entry.label) : zhTW.home.regOpen(registration.entry.label, registration.daysRemaining)}</span><a href={activeExam.officialLinks?.registration ?? NATIONAL_EXAM_SCHEDULE_SOURCE} rel="noreferrer" target="_blank">{zhTW.home.regAction}</a></p> : null}
    {showBackupNudge ? <p className="sync-nudge"><CloudOff size={16} /><span>{zhTW.home.syncOff(props.seen)}</span><button onClick={props.onOpenSettings} type="button">{zhTW.home.syncOffAction}</button></p> : null}
    {props.seen > 0 ? <p className="study-local-note">進度保存在這台裝置。</p> : null}
  </main>
}
