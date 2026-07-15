import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPersistenceState,
  PERSIST_AFTER_ATTEMPTS,
  requestPersistence,
  shouldRequestPersistence,
} from './persistence'

function stubStorage(storage: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: storage === undefined ? {} : { storage },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'navigator')
})

describe('shouldRequestPersistence', () => {
  it('waits until there is progress worth keeping', () => {
    expect(shouldRequestPersistence(0)).toBe(false)
    expect(shouldRequestPersistence(PERSIST_AFTER_ATTEMPTS - 1)).toBe(false)
  })

  it('asks once the threshold is reached', () => {
    expect(shouldRequestPersistence(PERSIST_AFTER_ATTEMPTS)).toBe(true)
    expect(shouldRequestPersistence(500)).toBe(true)
  })
})

describe('getPersistenceState', () => {
  it('reports unsupported where the API is missing, rather than claiming safety', async () => {
    stubStorage(undefined)
    expect(await getPersistenceState()).toBe('unsupported')
  })

  it('distinguishes a committed grant from best-effort storage', async () => {
    stubStorage({ persisted: async () => true, persist: async () => true })
    expect(await getPersistenceState()).toBe('persisted')
    stubStorage({ persisted: async () => false, persist: async () => false })
    expect(await getPersistenceState()).toBe('best-effort')
  })
})

describe('requestPersistence', () => {
  it('does not re-ask once already granted', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => true, persist })
    expect(await requestPersistence()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('asks when storage is only best-effort', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => false, persist })
    expect(await requestPersistence()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('reports a refusal without throwing, so a denial never breaks a session', async () => {
    stubStorage({ persisted: async () => false, persist: async () => false })
    expect(await requestPersistence()).toBe(false)
  })

  it('survives a browser that rejects the request outright', async () => {
    stubStorage({ persisted: async () => false, persist: async () => { throw new Error('denied') } })
    await expect(requestPersistence()).resolves.toBe(false)
  })

  it('returns false where the API is missing', async () => {
    stubStorage(undefined)
    expect(await requestPersistence()).toBe(false)
  })
})
