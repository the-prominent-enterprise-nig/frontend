import type { LedgerNote } from '@/src/schema/crm/types'

/** How a ledger row's repair / return note reads, on screen and on paper. */
export const LEDGER_NOTE_LABELS: Record<LedgerNote, string> = {
  repair: 'Repair',
  return: 'Return',
  repossess: 'Repossess',
  cm: 'CM',
  paused: 'Paused',
}

/** The note as the printed ledger writes it after the description —
 * " (Repair)", " (Return)", " (Repossess)",
 * " (CM)", or nothing. */
export function ledgerNoteSuffix(note?: LedgerNote): string {
  return note ? ` (${LEDGER_NOTE_LABELS[note]})` : ''
}
