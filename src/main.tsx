import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ActiveExamProvider } from './app/ActiveExamProvider'
import App from './App'
import './styles.css'

// Apply the saved theme before first paint to avoid a flash.
const savedTheme = localStorage.getItem('level-b-theme')
if (savedTheme === 'dark' || savedTheme === 'light') {
  document.documentElement.dataset.theme = savedTheme
}

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateServiceWorker(true)
  },
  onRegisteredSW(_scriptUrl, registration) {
    registration?.update().catch(() => undefined)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ActiveExamProvider>
      <App />
    </ActiveExamProvider>
  </StrictMode>,
)
