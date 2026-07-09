import { ArrowRight, Timer } from 'lucide-react'
import { zhTW } from '../../i18n/zh-TW'

interface Props {
  onMock: () => void
  onMockTraining: () => void
}

export function MockExamPage(props: Props) {
  return (
    <main className="page dashboard-page">
      <header className="page-title">
        <p className="eyebrow">{zhTW.mock.eyebrow}</p>
        <h1>{zhTW.mock.title}</h1>
        <p>{zhTW.mock.description}</p>
      </header>

      <section className="mock-band">
        <div className="mock-copy">
          <span className="mode-icon dark"><Timer size={22} /></span>
          <div>
            <p className="eyebrow">{zhTW.mock.officialFormat}</p>
            <h2>{zhTW.mock.mock80}</h2>
            <p>{zhTW.mock.formatHint}</p>
          </div>
        </div>
        <div className="mock-actions">
          <button onClick={props.onMock} type="button">{zhTW.mock.official} <ArrowRight size={17} /></button>
          <button onClick={props.onMockTraining} type="button">{zhTW.mock.training} <ArrowRight size={17} /></button>
        </div>
      </section>
    </main>
  )
}
