import type { BankRevision } from '../../storage/bankRevision'

/**
 * Official bank revisions, in the order they shipped. Append only — the order
 * is how a device knows which revisions its saved data still needs. Each one
 * is a lazy chunk, so only learners with data to migrate download it.
 */
export const BANK_REVISIONS: { id: string; load: () => Promise<BankRevision> }[] = [
  { id: '116-1', load: () => import('./generated-116-1').then((module) => module.BANK_REVISION) },
  { id: '116-2', load: () => import('./generated-116-2').then((module) => module.BANK_REVISION) },
  { id: '116-3', load: () => import('./generated-116-3').then((module) => module.BANK_REVISION) },
]
