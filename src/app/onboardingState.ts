export const ONBOARDING_DONE_KEY = 'level-up-onboarding-complete'
export const PROFILE_NAME_KEY = 'level-up-profile-name'

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === 'true'
}

export function shouldShowLanding({
  onboarded,
  hasSyncLink,
  forceWelcome = false,
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
  return forceWelcome || !onboarded
}
