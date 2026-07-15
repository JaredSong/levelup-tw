// Generated sync code — the identity behind cross-device sync.
//
// Replaces "pick a memorable passphrase". There is no account and no email, so
// a passphrase the learner can remember is also one a stranger can guess, and
// the cloud key is only a hash of it: guessing it means reading someone's study
// record, and colliding with it means silently merging two people's history.
// Mixing in the display name only bought a few bits on top of a guessable
// secret, and made a cosmetic field un-editable. A generated code closes both:
// ~58 bits means neither collision nor guessing is a live concern.
//
// The trade is honest: this cannot be remembered, so it must be findable. It is
// shown permanently in Settings rather than once at onboarding, and the backup
// export — not this code — is the real recovery path if the only device is lost.

/** No 0/O/1/I/L/U: they are the characters people misread when copying by hand. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const GROUP = 4
const GROUPS = 3
export const SYNC_CODE_LENGTH = GROUP * GROUPS

export interface RandomSource {
  getRandomValues<T extends Uint8Array>(array: T): T
}

/**
 * A fresh code, e.g. "K7M2P4Q9RSTV". 30^12 ≈ 5.3e17 (~58 bits).
 *
 * Rejection-samples so each character is uniform: taking `byte % 30` would make
 * the first 16 letters of the alphabet slightly likelier than the rest.
 */
export function generateSyncCode(random: RandomSource = crypto): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length
  let code = ''
  const buffer = new Uint8Array(SYNC_CODE_LENGTH * 2)
  while (code.length < SYNC_CODE_LENGTH) {
    random.getRandomValues(buffer)
    for (const byte of buffer) {
      if (byte >= limit) continue
      code += ALPHABET[byte % ALPHABET.length]
      if (code.length === SYNC_CODE_LENGTH) break
    }
  }
  return code
}

/** Display form, grouped for reading aloud and copying: "K7M2-P4Q9-RSTV". */
export function formatSyncCode(code: string): string {
  const normalized = normalizeSyncCode(code)
  if (!normalized) return ''
  return normalized.match(new RegExp(`.{1,${GROUP}}`, 'g'))!.join('-')
}

/**
 * Accept what a human or a scanner actually produces — lowercase, spaces, the
 * display dashes — without inventing characters. Anything else is left in place
 * so `isValidSyncCode` can reject it: silently dropping an unexpected character
 * would shift the rest and yield a wrong code of the right length, which fails
 * later as "no progress found" instead of "that code is wrong".
 */
export function normalizeSyncCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export function isValidSyncCode(input: string): boolean {
  const normalized = normalizeSyncCode(input)
  return normalized.length === SYNC_CODE_LENGTH
    && [...normalized].every((character) => ALPHABET.includes(character))
}

/**
 * Handoff link for the QR. A fragment, never a query string: fragments are not
 * sent to the server or logged by it, and the code is the whole secret.
 *
 * The QR carries this link rather than the study data — a record runs to
 * hundreds of KB against a QR ceiling of ~3KB — so the second device still
 * pulls from the cloud. Encoding a URL also means the phone's own camera opens
 * it: no in-app scanner, no camera permission, no decoder to ship.
 */
export const SYNC_LINK_FRAGMENT = 'sync='

export function buildSyncLink(code: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/#${SYNC_LINK_FRAGMENT}${normalizeSyncCode(code)}`
}

/** The code carried by a scanned link, or null. Tolerates a full URL or a bare fragment. */
export function readSyncLink(hashOrUrl: string): string | null {
  const at = hashOrUrl.indexOf(SYNC_LINK_FRAGMENT)
  if (at === -1) return null
  const raw = hashOrUrl.slice(at + SYNC_LINK_FRAGMENT.length).split(/[&/?]/)[0]
  const code = normalizeSyncCode(decodeURIComponent(raw))
  return isValidSyncCode(code) ? code : null
}
