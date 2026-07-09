import { ArrowRight, Timer } from 'lucide-react'

interface Props {
  onMock: () => void
  onMockTraining: () => void
}

export function MockExamPage(props: Props) {
  return (
    <main className="page dashboard-page">
      <header className="page-title">
        <p className="eyebrow">Mock Exam</p>
        <h1>Timed validation</h1>
        <p>Use official mode to pace the real test; use training mode when you want feedback as you go.</p>
      </header>

      <section className="mock-band">
        <div className="mock-copy">
          <span className="mode-icon dark"><Timer size={22} /></span>
          <div>
            <p className="eyebrow">Official format</p>
            <h2>80-question mock</h2>
            <p>60 single · 20 multiple · four questions from each general subject</p>
          </div>
        </div>
        <div className="mock-actions">
          <button onClick={props.onMock} type="button">Official <ArrowRight size={17} /></button>
          <button onClick={props.onMockTraining} type="button">Training <ArrowRight size={17} /></button>
        </div>
      </section>
    </main>
  )
}
