export const SUPPORT_SNOOZE_KEY = 'level-up-support-snoozed-until'
const COOLDOWN_MS = 14 * 86_400_000

export function canShowSupportPrompt(attempts: number, sessionAnswers: number, now = Date.now(), storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  const until = Number(storage.getItem(SUPPORT_SNOOZE_KEY) ?? 0)
  return attempts >= 20 && sessionAnswers >= 5 && (!Number.isFinite(until) || now >= until)
}

/** Count an impression, not just a dismissal, so ignoring it still grants quiet. */
export function snoozeSupportPrompt(now = Date.now(), storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(SUPPORT_SNOOZE_KEY, String(now + COOLDOWN_MS))
}
