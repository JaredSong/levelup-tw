import { describe, expect, it } from 'vitest'
import {
  buildSyncLink,
  formatSyncCode,
  generateSyncCode,
  isValidSyncCode,
  normalizeSyncCode,
  readSyncLink,
  SYNC_CODE_LENGTH,
  type RandomSource,
} from './syncCode'

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Deterministic bytes, so generation can be asserted rather than sampled. */
function fixedRandom(bytes: number[]): RandomSource {
  let index = 0
  return {
    getRandomValues<T extends Uint8Array>(array: T): T {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = bytes[index % bytes.length]
        index += 1
      }
      return array
    },
  }
}

describe('generateSyncCode', () => {
  it('produces a code of the expected length from the safe alphabet', () => {
    const code = generateSyncCode()
    expect(code).toHaveLength(SYNC_CODE_LENGTH)
    expect([...code].every((character) => ALPHABET.includes(character))).toBe(true)
  })

  it('never emits the characters people misread when copying', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateSyncCode()).not.toMatch(/[01ILOU]/)
    }
  })

  it('does not repeat across calls', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateSyncCode()))
    expect(codes.size).toBe(200)
  })

  it('maps bytes through the alphabet deterministically', () => {
    // Byte 0 -> ALPHABET[0], byte 1 -> ALPHABET[1], and so on.
    expect(generateSyncCode(fixedRandom([0]))).toBe(ALPHABET[0].repeat(SYNC_CODE_LENGTH))
    expect(generateSyncCode(fixedRandom([1]))).toBe(ALPHABET[1].repeat(SYNC_CODE_LENGTH))
  })

  it('rejection-samples so no character is likelier than another', () => {
    // 240 is the first byte at/above the 30-multiple cutoff (8 * 30 = 240), so it
    // must be discarded rather than folded to 240 % 30 === 0.
    const code = generateSyncCode(fixedRandom([240, 5]))
    expect(code).toBe(ALPHABET[5].repeat(SYNC_CODE_LENGTH))
  })
})

describe('formatSyncCode', () => {
  it('groups into readable blocks', () => {
    expect(formatSyncCode('K7M2P4Q9RSTV')).toBe('K7M2-P4Q9-RSTV')
  })

  it('is idempotent, so a formatted code can be re-formatted', () => {
    expect(formatSyncCode('K7M2-P4Q9-RSTV')).toBe('K7M2-P4Q9-RSTV')
  })

  it('returns empty for empty input', () => {
    expect(formatSyncCode('')).toBe('')
  })
})

describe('normalizeSyncCode', () => {
  it('accepts what a human or a scanner actually produces', () => {
    expect(normalizeSyncCode('k7m2-p4q9-rstv')).toBe('K7M2P4Q9RSTV')
    expect(normalizeSyncCode('  K7M2 P4Q9 RSTV  ')).toBe('K7M2P4Q9RSTV')
  })

  it('leaves unexpected characters in place rather than silently dropping them', () => {
    // Dropping would shift the rest and yield a wrong code of the right length,
    // failing later as "no progress found" instead of "that code is wrong".
    expect(normalizeSyncCode('K7M2-P4Q9-RSTO')).toBe('K7M2P4Q9RSTO')
    expect(isValidSyncCode('K7M2-P4Q9-RSTO')).toBe(false)
  })
})

describe('buildSyncLink / readSyncLink', () => {
  it('round-trips a code through a link', () => {
    const code = generateSyncCode()
    const link = buildSyncLink(code, 'https://levelup-tw.pages.dev')
    expect(readSyncLink(link)).toBe(code)
  })

  it('puts the code in the fragment, never the query string', () => {
    // A fragment is not sent to the server; the code is the whole secret.
    const link = buildSyncLink('K7M2P4Q9RSTV', 'https://levelup-tw.pages.dev')
    expect(link).toBe('https://levelup-tw.pages.dev/#sync=K7M2P4Q9RSTV')
    expect(link).not.toContain('?')
  })

  it('tolerates a trailing slash on the origin', () => {
    expect(buildSyncLink('K7M2P4Q9RSTV', 'https://levelup-tw.pages.dev/'))
      .toBe('https://levelup-tw.pages.dev/#sync=K7M2P4Q9RSTV')
  })

  it('reads a bare fragment as well as a full URL', () => {
    expect(readSyncLink('#sync=K7M2P4Q9RSTV')).toBe('K7M2P4Q9RSTV')
  })

  it('returns null when there is no code to read', () => {
    expect(readSyncLink('')).toBeNull()
    expect(readSyncLink('https://levelup-tw.pages.dev/')).toBeNull()
    expect(readSyncLink('#tab=home')).toBeNull()
  })

  it('returns null rather than a broken code when the link is malformed', () => {
    expect(readSyncLink('#sync=TOOSHORT')).toBeNull()
    expect(readSyncLink('#sync=K7M2P4Q9RSTO')).toBeNull() // O is not in the alphabet
  })
})

describe('isValidSyncCode', () => {
  it('accepts a freshly generated code in both raw and display form', () => {
    const code = generateSyncCode()
    expect(isValidSyncCode(code)).toBe(true)
    expect(isValidSyncCode(formatSyncCode(code))).toBe(true)
    expect(isValidSyncCode(formatSyncCode(code).toLowerCase())).toBe(true)
  })

  it('rejects wrong lengths', () => {
    expect(isValidSyncCode('')).toBe(false)
    expect(isValidSyncCode('K7M2P4Q9RST')).toBe(false)
    expect(isValidSyncCode('K7M2P4Q9RSTVW')).toBe(false)
  })

  it('rejects excluded lookalike characters', () => {
    for (const bad of ['0', '1', 'I', 'L', 'O', 'U']) {
      expect(isValidSyncCode(`K7M2P4Q9RST${bad}`), bad).toBe(false)
    }
  })
})
