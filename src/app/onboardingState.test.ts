import { describe, expect, it } from 'vitest'
import { shouldShowLanding } from './onboardingState'

describe('public landing entry', () => {
  it('shows the landing page only to new visitors without a sync link', () => {
    expect(shouldShowLanding({ onboarded: false, hasSyncLink: false })).toBe(true)
    expect(shouldShowLanding({ onboarded: true, hasSyncLink: false })).toBe(false)
    expect(shouldShowLanding({ onboarded: false, hasSyncLink: true })).toBe(false)
  })

  it('never puts the public landing page in front of the PWA app entry', () => {
    expect(shouldShowLanding({ onboarded: false, hasSyncLink: false, forceApp: true })).toBe(false)
  })
})
