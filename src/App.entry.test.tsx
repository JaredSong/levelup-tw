import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from './App'
import { ActiveExamProvider } from './app/ActiveExamProvider'
import { ACTIVE_EXAM_KEY, SELECTED_EXAMS_KEY } from './app/activeExam'
import { ONBOARDING_DONE_KEY } from './app/onboardingState'

// Exercise the real App and provider with an immediately available bank. This
// verifies which screen an existing install renders, not just a route helper.
vi.mock('./hooks/useQuestionBank', () => ({ useQuestionBank: () => ({ bank: { questions: [], byId: new Map() }, error: null }) }))
vi.mock('./hooks/useStudyData', () => ({ useStudyData: () => ({ progress: {}, loading: false, setProgress: vi.fn(), refresh: vi.fn() }) }))

let values: Map<string, string>
let storage: Storage
beforeEach(() => {
  values = new Map([
    [ONBOARDING_DONE_KEY, 'true'],
    [ACTIVE_EXAM_KEY, 'digital-electronics-b'],
    [SELECTED_EXAMS_KEY, JSON.stringify(['digital-electronics-b', 'web-design-b'])],
    ['level-b-active-session:digital-electronics-b', JSON.stringify({ id: 'existing-session', examId: 'digital-electronics-b', mode: 'sequential', title: '順序練習', questionIds: ['saved-1', 'saved-2'], answers: { 'saved-1': { correct: true, selected: [1] } }, selections: {}, currentIndex: 1 })],
    ['level-b-sequential-index:digital-electronics-b', '320'],
  ])
  storage = {
    getItem: key => values.get(key) ?? null,
    setItem: vi.fn((key, value) => { values.set(key, value) }),
    removeItem: vi.fn(key => { values.delete(key) }),
    clear: vi.fn(), key: index => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('document', { documentElement: { dataset: { theme: 'light' } } })
})
afterEach(() => vi.unstubAllGlobals())
function open(path: string, standalone = false, iosStandalone = false) {
  vi.stubGlobal('window', { location: { pathname: path, hash: '', search: '' }, matchMedia: (query: string) => ({ matches: query === '(display-mode: standalone)' && standalone }) })
  vi.stubGlobal('navigator', { userAgent: iosStandalone ? 'iPhone' : 'Chrome', standalone: iosStandalone })
  return renderToString(<ActiveExamProvider><App /></ActiveExamProvider>)
}
describe('existing installed app entry compatibility', () => {
  it.each([
    ['current PWA launch', '/app', true, false],
    ['legacy root PWA launch', '/', true, false],
    ['legacy iOS home-screen launch', '/', false, true],
    ['browser app bookmark', '/app', false, false],
    ['trailing slash app bookmark', '/app/', false, false],
  ])('%s resumes the saved subject without landing or onboarding', (_label, path, standalone, ios) => {
    const before = new Map(values)
    const html = open(path, standalone, ios)
    expect(html).toContain('數位電子乙級')
    expect(html).toContain('繼續練習')
    expect(html).toContain('這一組，還有 1 題。')
    expect(html).not.toContain('class="landing-hero"')
    expect(html).not.toContain('class="onboarding-screen"')
    expect(values).toEqual(before)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
  })
  it('keeps the public browser homepage accessible without altering the saved profile', () => {
    const html = open('/')
    expect(html).toContain('class="landing-hero"')
    expect(html).toContain('繼續練習')
    expect(storage.setItem).not.toHaveBeenCalled()
  })
  it.each(['/exams', '/exams/'])('serves the exam catalog at %s without touching the saved profile', (path) => {
    const html = open(path)
    expect(html).toContain('class="catalog-hero"')
    expect(html).toContain('href="/exam/web-design-b/"')
    expect(html).not.toContain('class="landing-hero"')
    expect(storage.setItem).not.toHaveBeenCalled()
  })
  it('still requires subject selection for a fresh /app install', () => {
    values.delete(ONBOARDING_DONE_KEY)
    expect(open('/app', true)).toContain('class="onboarding-screen"')
  })
})
