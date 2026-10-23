import { describe, expect, it } from 'vitest'
import { canShowSupportPrompt, snoozeSupportPrompt } from './supportPrompt'

describe('support reminder frequency', () => {
  it('waits for useful study and a completed set of at least five answers', () => {
    const storage = { getItem: () => null }
    expect(canShowSupportPrompt(19, 10, 0, storage)).toBe(false)
    expect(canShowSupportPrompt(200, 1, 0, storage)).toBe(false)
    expect(canShowSupportPrompt(20, 10, 0, storage)).toBe(true)
  })
  it('suppresses future sessions for 14 days after an impression, even without dismissal', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    const now = Date.UTC(2026, 9, 22)
    snoozeSupportPrompt(now, storage)
    expect(canShowSupportPrompt(50, 10, now + 1, storage)).toBe(false)
    expect(canShowSupportPrompt(500, 10, now + 14 * 86_400_000 - 1, storage)).toBe(false)
    expect(canShowSupportPrompt(500, 10, now + 14 * 86_400_000, storage)).toBe(true)
  })
})
