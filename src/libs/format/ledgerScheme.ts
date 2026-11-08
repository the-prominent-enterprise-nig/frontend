import type { InstallmentLedger } from '@/src/schema/crm/types'

/**
 * The Scheme a plan's ledger shows: the one its Sale row carries — the Price
 * Use the plan was sold under (WIP, SSC, …), or "Price Override" when the
 * sale's price was manually overridden — else the account's own Price Use.
 * Shared by the ledger screen and its printed paper form so they never differ.
 */
export function ledgerScheme(ledger: Pick<InstallmentLedger, 'account' | 'rows'>): string {
  return ledger.rows.find((r) => r.scheme)?.scheme ?? ledger.account.priceUseType?.name ?? '—'
}
