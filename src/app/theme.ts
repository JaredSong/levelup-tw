// Theme is stored on <html data-theme> so it applies before React mounts (see
// main.tsx), with localStorage as the durable record of an explicit choice.
// With nothing stored we follow the OS, and main.tsx keeps tracking it.

export const THEME_KEY = 'level-b-theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

export type Theme = 'light' | 'dark'

export function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** Whatever is on the document right now — set before first paint by main.tsx. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** Record an explicit choice. From here on the OS no longer overrides it. */
export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.dataset.theme = theme
}
