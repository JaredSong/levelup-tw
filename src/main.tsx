import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Apply the saved theme before first paint to avoid a flash.
const savedTheme = localStorage.getItem('level-b-theme')
if (savedTheme === 'dark' || savedTheme === 'light') {
  document.documentElement.dataset.theme = savedTheme
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
