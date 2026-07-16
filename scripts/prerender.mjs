// Injects server-rendered landing HTML into dist/index.html after `vite build`.
//
// Why: the app is a client-rendered SPA, so the built page ships an empty
// <div id="root"> — a crawler that doesn't execute JS sees no content at all.
// This renders src/entry-prerender.tsx (the landing page with the bundled exam
// manifests) via a throwaway SSR build and splices the markup into #root.
// main.tsx's createRoot().render() replaces it as soon as the bundle loads.
import { execSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const SSR_OUT = new URL('../dist-ssr/', import.meta.url)
const INDEX = new URL('../dist/index.html', import.meta.url)
const MARKER = '<div id="root"></div>'

execSync('npx vite build --ssr src/entry-prerender.tsx --outDir dist-ssr --emptyOutDir', {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
})

// renderToString never runs effects, but LandingPage reads the current theme
// during render — give it just enough DOM to answer "light".
globalThis.document = { documentElement: { dataset: { theme: 'light' } } }
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  scrollY: 0,
}

const { renderLanding } = await import(new URL('entry-prerender.js', SSR_OUT))
const landingHtml = renderLanding()
if (!landingHtml.includes('landing-hero')) {
  throw new Error('prerender: rendered HTML is missing the landing hero — output looks wrong')
}

const indexHtml = readFileSync(INDEX, 'utf8')
if (!indexHtml.includes(MARKER)) {
  throw new Error(`prerender: ${MARKER} not found in dist/index.html`)
}
writeFileSync(INDEX, indexHtml.replace(MARKER, `<div id="root">${landingHtml}</div>`))
rmSync(SSR_OUT, { recursive: true, force: true })
console.log(`prerender: injected ${Math.round(landingHtml.length / 1024)} kB of landing HTML into dist/index.html`)
