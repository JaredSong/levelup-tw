import {
  ArrowRight,
  Brain,
  Clock3,
  CloudOff,
  Compass,
  Flame,
  Headphones,
  Layers3,
  ListRestart,
  Shuffle,
  Target,
  Timer,
  Zap,
} from 'lucide-react'
import { formatCurrentBankLabel, formatMockFormatHint, formatSyllabusItems, homeStudyCopyForExam } from '../app/activeExam'
import { useActiveExam } from '../app/useActiveExam'
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
  onFresh: (limit: number) => void
  onHighYield: () => void
  onSubject: (subjectCode: string, title: string) => void
  onWrong: () => void
  onFlashcards: () => void
  onCommuteNotes: () => void
  onMock: () => void
  onMockTraining: () => void
  onSprint: () => void
}

function daysUntilExam() {
  const now = new Date()
  const exam = new Date('2026-07-05T14:00:00+08:00')
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000))
}

export function Dashboard(props: Props) {
  const { activeExam } = useActiveExam()
  const syllabusItems = formatSyllabusItems(activeExam)
  const studyCopy = homeStudyCopyForExam(activeExam)
  const completion = props.total ? Math.round((props.seen / props.total) * 100) : 0
  const primaryLabel = props.hasSession ? props.sessionLabel : studyCopy.continueFrom

  return (
    <main className="page dashboard-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">目前題庫：{formatCurrentBankLabel(activeExam)}</p>
          <h1>升級吧</h1>
          <p className="header-subtitle">{studyCopy.subtitle}</p>
        </div>
        <div className="exam-countdown" aria-label={`距離筆試 ${daysUntilExam()} 天`}>
          <strong>{daysUntilExam()}</strong>
          <span>天</span>
        </div>
      </header>

      {!isSyncEnabled() ? (
        <p className="sync-nudge"><CloudOff size={16} /> 雲端同步尚未開啟；可到「進度」設定通關密語。</p>
      ) : null}

      <section className="readiness-strip" aria-label="學習概況">
        <div>
          <span>已練</span>
          <strong>{props.seen}</strong>
        </div>
        <div>
          <span>待複習</span>
          <strong>{props.due}</strong>
        </div>
        <div>
          <span>正確率</span>
          <strong>{props.accuracy}%</strong>
        </div>
      </section>

      <section className="syllabus-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">最新範圍</p>
            <h2>必考題庫已納入</h2>
          </div>
          <strong>{props.total.toLocaleString()}</strong>
        </div>
        <div className="syllabus-list">
          {syllabusItems.map(({ code, label, meta }) => (
            <button key={code} onClick={() => props.onSubject(code, `${label} · 隨機 10 題`)} type="button">
              <span>{code}</span><strong>{label}</strong><small>{meta}</small><ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <button className="continue-panel" onClick={props.hasSession ? props.onContinue : props.onSequential} type="button">
        <span className="continue-icon"><ArrowRight size={23} strokeWidth={2} /></span>
          <span className="continue-copy">
            <span className="action-kicker">下一步</span>
            <strong>{primaryLabel}</strong>
          <span>{props.hasSession ? '你的題目位置已儲存。' : studyCopy.startSmallFreshSet}</span>
        </span>
        <ArrowRight className="continue-arrow" size={22} strokeWidth={1.8} />
      </button>

      <section className="coverage-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">完成度</p>
            <h2>{props.seen} / {props.total} 題已記錄</h2>
          </div>
          <span>{completion}%</span>
        </div>
        <div className="progress-track" aria-label={`完成 ${completion}%`}>
          <span style={{ width: `${completion}%` }} />
        </div>
      </section>

      <section className="mode-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">練習</p>
            <h2>選擇練習方式</h2>
          </div>
        </div>
        <div className="mode-list">
          <button type="button" onClick={props.onSprint}>
            <span className="mode-icon coral"><Zap size={21} /></span>
            <span><strong>考前衝刺</strong><small>20 題 · 偏向弱點 · 適合短時間</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onAdaptive}>
            <span className="mode-icon violet"><Brain size={21} /></span>
            <span><strong>待複習 10 題</strong><small>排程複習 · 接著補弱點/新題</small></span>
            <span className="mode-meta">10</span>
          </button>
          <button type="button" onClick={() => props.onFresh(20)}>
            <span className="mode-icon blue"><Compass size={21} /></span>
            <span><strong>新題衝刺</strong><small>20 題 · 優先未練過</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onHighYield}>
            <span className="mode-icon slate"><Target size={21} /></span>
            <span><strong>小模擬 20</strong><small>依正式比例抽題</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onWrong}>
            <span className="mode-icon coral"><ListRestart size={21} /></span>
            <span><strong>錯題複習</strong><small>固定佇列，不會跳回第 1 題</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
          <button type="button" onClick={props.onRandom}>
            <span className="mode-icon blue"><Shuffle size={21} /></span>
            <span><strong>隨機 10 題</strong><small>混合目前考科範圍</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onFlashcards}>
            <span className="mode-icon violet"><Layers3 size={21} /></span>
            <span><strong>回想卡</strong><small>先回想，再評分自己是否記得</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onCommuteNotes}>
            <span className="mode-icon slate"><Headphones size={21} /></span>
            <span><strong>通勤筆記</strong><small>整理錯題 · 快速記憶提示</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
        </div>
      </section>

      <section className="mock-band">
        <div className="mock-copy">
          <span className="mode-icon dark"><Timer size={22} /></span>
          <div>
            <p className="eyebrow">正式格式</p>
            <h2>80 題模擬</h2>
            <p>{formatMockFormatHint(activeExam)}</p>
          </div>
        </div>
        <div className="mock-actions">
          <button onClick={props.onMock} type="button">正式 <ArrowRight size={17} /></button>
          <button onClick={props.onMockTraining} type="button">訓練 <ArrowRight size={17} /></button>
        </div>
      </section>

      <aside className="today-note">
        <Clock3 size={18} />
        <p><strong>{studyCopy.shortSessionTitle}</strong> {studyCopy.shortSessionBody}</p>
        <Flame size={18} />
      </aside>
    </main>
  )
}
