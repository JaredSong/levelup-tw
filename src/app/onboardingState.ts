export const ONBOARDING_DONE_KEY = 'level-up-onboarding-complete'
export const PROFILE_NAME_KEY = 'level-up-profile-name'

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === 'true'
}
