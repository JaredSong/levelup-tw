export const ONBOARDING_DONE_KEY = 'level-up-onboarding-complete'
export const PROFILE_NAME_KEY = 'level-up-profile-name'
export const INSTALL_NUDGE_DISMISSED_KEY = 'level-up-install-nudge-dismissed'

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === 'true'
}

/** The install nudge is one-and-done: dismissing or installing silences it for good. */
export function isInstallNudgeDismissed(): boolean {
  return localStorage.getItem(INSTALL_NUDGE_DISMISSED_KEY) === 'true'
}

export function dismissInstallNudge(): void {
  localStorage.setItem(INSTALL_NUDGE_DISMISSED_KEY, 'true')
}

export function shouldShowLanding({
  hasSyncLink,
  forceApp = false,
  standalone = false,
}: {
  onboarded: boolean
  hasSyncLink: boolean
  forceWelcome?: boolean
  forceApp?: boolean
  standalone?: boolean
}): boolean {
  if (hasSyncLink) return false
  if (forceApp || standalone) return false
  // Keep legacy installs whose start URL is "/" in the study app. A normal
  // browser visit gets the public homepage even after onboarding is complete.
  return true
}
