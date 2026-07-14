import { ArrowRight, CheckCircle2, Clock3, Timer } from 'lucide-react'
import { zhTW } from '../../i18n/zh-TW'
import { formatMockFormatHint } from '../activeExam'
import { useActiveExam } from '../useActiveExam'

interface Props {
  onMock: () => void
  onMockTraining: () => void
}

export function MockExamPage(props: Props) {
  const { activeExam } = useActiveExam()
  const rules = activeExam.mockRules
  const typeSummary = [
    rules.singleCount ? `${rules.singleCount} 題單選` : null,
    rules.multipleCount ? `${rules.multipleCount} 題複選` : null,
  ].filter(Boolean).join(' · ')

  return (
    <main className="page dashboard-page">
      <header className="page-title">
        <p className="eyebrow">{zhTW.mock.eyebrow}</p>
        <h1>{zhTW.mock.title}</h1>
        <p>{zhTW.mock.description}</p>
      </header>

      <section className="mock-panel">
        <div className="mock-panel-head">
          <span className="mode-icon dark"><Timer size={22} /></span>
          <div>
            <p className="eyebrow">{zhTW.mock.officialFormat}</p>
            <h2>{zhTW.mock.mock80}</h2>
            <p>{formatMockFormatHint(activeExam)}</p>
          </div>
        </div>

        <div className="mock-facts">
          <span><Clock3 size={16} /><strong>{rules.durationMinutes}</strong><small>分鐘</small></span>
          <span><CheckCircle2 size={16} /><strong>{rules.passScore}</strong><small>及格</small></span>
          <span><strong>{typeSummary}</strong><small>題型</small></span>
        </div>

        <div className="mock-mode-grid">
          <button className="mock-mode-card primary" onClick={props.onMock} type="button">
            <span>
              <strong>{zhTW.mock.official}</strong>
              <small>{zhTW.mock.officialHint}</small>
            </span>
            <ArrowRight size={18} />
          </button>
          <button className="mock-mode-card" onClick={props.onMockTraining} type="button">
            <span>
              <strong>{zhTW.mock.training}</strong>
              <small>{zhTW.mock.trainingHint}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  )
}
