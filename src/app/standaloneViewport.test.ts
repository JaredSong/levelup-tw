import { describe, expect, it } from 'vitest'
import { installStandaloneViewportFix } from './standaloneViewport'

function fakeHost(standalone: boolean) {
  const listeners = new Map<string, () => void>()
  const docListeners = new Map<string, () => void>()
  const calls: string[] = []
  const host = {
    innerHeight: 800,
    scrollY: 0,
    scrollTo: (_x: number, y: number) => { calls.push(`scroll ${y}`) },
    requestAnimationFrame: (callback: () => void) => { callback(); return 1 },
    setTimeout: () => 7,
    clearTimeout: () => {},
    matchMedia: () => ({ matches: standalone }),
    addEventListener: (type: string, listener: () => void) => { listeners.set(type, listener) },
    removeEventListener: (type: string) => { listeners.delete(type) },
    navigator: {},
    document: {
      visibilityState: 'visible',
      body: { style: { minHeight: '' }, get offsetHeight() { calls.push(`layout ${host.document.body.style.minHeight}`); return 800 } },
      addEventListener: (type: string, listener: () => void) => { docListeners.set(type, listener) },
      removeEventListener: (type: string) => { docListeners.delete(type) },
    },
  }
  return { host, calls, listeners, docListeners }
}

describe('standalone viewport fix', () => {
  it('does nothing in a browser tab', () => {
    const { host, calls, listeners } = fakeHost(false)
    installStandaloneViewportFix(host)
    expect(calls).toEqual([])
    expect(listeners.size).toBe(0)
  })

  it('re-measures on launch and on return to the foreground, then restores the page', () => {
    const { host, calls, docListeners } = fakeHost(true)
    const uninstall = installStandaloneViewportFix(host)
    expect(calls).toEqual(['layout 801px', 'scroll 1', 'scroll 0'])
    expect(host.document.body.style.minHeight).toBe('')
    docListeners.get('visibilitychange')!()
    expect(calls).toHaveLength(6)
    uninstall()
    expect(docListeners.size).toBe(0)
  })
})
