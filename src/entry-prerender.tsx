// Build-time only entry: scripts/prerender.mjs renders the landing page into
// dist/index.html so crawlers get real HTML instead of an empty #root (the app
// is otherwise a fully client-rendered SPA). Never imported by the browser
// bundle — main.tsx's createRoot().render() replaces this markup on load.
import { renderToString } from 'react-dom/server'
import { INSTALLED_EXAMS } from './app/activeExam'
import { LandingPage } from './app/LandingPage'

const noop = () => undefined

export function renderLanding(): string {
  return renderToString(
    <LandingPage exams={INSTALLED_EXAMS} onEnter={noop} onSelectExam={noop} returning={false} />,
  )
}
