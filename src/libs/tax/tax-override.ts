// Scenario 69 Part I — a tax code changed away from the default.
//
// A purchase line starts on the input VAT code its supplier's VAT status calls
// for, a bill is withheld at its supplier's own code, an invoice or a sale is
// classified VAT-OUT-12 unless its customer is tax-exempt. Keeping something
// else is allowed, but it needs someone who may (accounting:tax-codes:override;
// at the register, the manager override), a reason, and is kept on the document
// with who and when. The server enforces all of it; these helpers only keep the
// form from walking into a refusal, and say the same thing the server would.

export const TAX_OVERRIDE_PERMISSION = 'accounting:tax-codes:override'
export const MIN_OVERRIDE_REASON = 3

export type TaxOverrideField = 'INPUT_VAT_CODE' | 'WITHHOLDING_CODE' | 'OUTPUT_VAT_CODE'

export const OVERRIDE_FIELD_LABEL: Record<TaxOverrideField, string> = {
  INPUT_VAT_CODE: 'Input VAT code',
  WITHHOLDING_CODE: 'Withholding tax code',
  OUTPUT_VAT_CODE: 'Output VAT class',
}

/** A change on a document's record: the change, why, who and when. */
export interface TaxOverrideEntry {
  field: TaxOverrideField
  /** The purchase line it is on (1-based); absent for a code on the whole document. */
  line?: number
  /** What the system would have chosen. */
  from: string | null
  /** What was kept. */
  to: string | null
  reason: string
  byUserId: string
  at: string
  approvedById?: string | null
  /** Named by the server for a document's own page. */
  byName?: string | null
  approvedByName?: string | null
}

/** A code kept away from its default, before it has a reason. */
export interface TaxOverrideChange {
  field: TaxOverrideField
  line?: number
  from: string | null
  to: string | null
}

const norm = (code: string | null | undefined): string | null => code?.trim().toUpperCase() || null

/** A code against the one the system would have chosen: a change only when there
 * is both a default to depart from and a code that was kept, and they differ. */
export function changeOf(
  field: TaxOverrideField,
  defaultCode: string | null | undefined,
  chosen: string | null | undefined,
  line?: number
): TaxOverrideChange | null {
  const from = norm(defaultCode)
  const to = norm(chosen)
  if (!from || !to || from === to) return null
  return { field, ...(line !== undefined ? { line } : {}), from, to }
}

/** Whether a document already carries an override for exactly this change. */
export function standingFor(
  entries: readonly TaxOverrideEntry[] | null | undefined,
  change: TaxOverrideChange
): TaxOverrideEntry | undefined {
  return (entries ?? []).find(
    (e) =>
      e.field === change.field &&
      (e.line ?? null) === (change.line ?? null) &&
      norm(e.to) === norm(change.to)
  )
}

/** The changes that are new: nothing on record covers them yet. */
export function freshChanges(
  changes: readonly TaxOverrideChange[],
  entries: readonly TaxOverrideEntry[] | null | undefined
): TaxOverrideChange[] {
  return changes.filter((c) => !standingFor(entries, c))
}

export const describeChange = (c: TaxOverrideChange): string =>
  `${OVERRIDE_FIELD_LABEL[c.field]}${c.line !== undefined ? ` on line ${c.line}` : ''}: ${c.from ?? 'none'} → ${c.to ?? 'none'}`

export const reasonOk = (reason: string): boolean => reason.trim().length >= MIN_OVERRIDE_REASON

/** The sentence a form shows when a reason is missing. */
export const reasonMissingMessage = (changes: readonly TaxOverrideChange[]): string =>
  `Say why ${changes.length > 1 ? 'these tax codes were' : 'this tax code was'} changed from ${
    changes.length > 1 ? 'their defaults' : 'its default'
  } (at least ${MIN_OVERRIDE_REASON} characters).`
