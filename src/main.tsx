import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ActiveExamProvider } from './app/ActiveExamProvider'
import { DARK_QUERY, systemTheme, THEME_KEY } from './app/theme'
import App from './App'
import './styles.css'

// Apply the theme before first paint to avoid a flash. With no saved choice we
// follow the OS, so a dark-mode device opens dark instead of always starting light.
const savedTheme = localStorage.getItem(THEME_KEY)
document.documentElement.dataset.theme = savedTheme === 'dark' || savedTheme === 'light'
  ? savedTheme
  : systemTheme()

// Keep tracking the OS until the user picks a side themselves.
window.matchMedia(DARK_QUERY).addEventListener('change', () => {
  if (localStorage.getItem(THEME_KEY)) return
  document.documentElement.dataset.theme = systemTheme()
})

let reloadingForUpdate = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return
    reloadingForUpdate = true
    window.location.reload()
  })
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
