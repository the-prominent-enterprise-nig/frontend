import type { TaxCodeOption } from '@/src/libs/data/AccountingV2Data'

// Scenario 69 Part F — a sale or an invoice carries one output VAT class, read
// off the tax code master. This module is the one place the screens learn
// which classes a document can take and what to call them. The server decides
// (and re-checks) every rule here; nothing in this file is authoritative.

export const OUTPUT_VAT_STANDARD = 'VAT-OUT-12'
export const OUTPUT_VAT_GOVERNMENT = 'VAT-OUT-GOV-12'
export const OUTPUT_VAT_ZERO_RATED = 'VAT-OUT-0ZR'
export const OUTPUT_VAT_EXEMPT = 'VAT-OUT-EXEMPT'
export const OUTPUT_VAT_OUT_OF_SCOPE = 'VAT-OUT-OOS'

/** What a counter sale can be classified as. */
export const POS_OUTPUT_VAT_CODES: readonly string[] = [
  OUTPUT_VAT_STANDARD,
  OUTPUT_VAT_ZERO_RATED,
  OUTPUT_VAT_EXEMPT,
]

/** What a manual AR invoice can be classified as. Out of scope is left out on
 * purpose: an invoice credits Sales revenue. */
export const AR_OUTPUT_VAT_CODES: readonly string[] = [
  OUTPUT_VAT_STANDARD,
  OUTPUT_VAT_GOVERNMENT,
  OUTPUT_VAT_ZERO_RATED,
  OUTPUT_VAT_EXEMPT,
]

/** Whoever holds this may classify an invoice as zero-rated or VAT-exempt. */
export const RESTRICTED_VAT_PERMISSION = 'accounting:ar-invoices:restricted-vat'

// Plain-language names for the picker. The master's own names ("Output VAT -
// Standard VATable Sale") read like ledger headings; the person at the counter
// needs to know what they are choosing.
const SHORT_NAME: Record<string, string> = {
  [OUTPUT_VAT_STANDARD]: 'VATable sale',
  [OUTPUT_VAT_GOVERNMENT]: 'Government VATable sale',
  [OUTPUT_VAT_ZERO_RATED]: 'Zero-rated sale',
  [OUTPUT_VAT_EXEMPT]: 'VAT-exempt sale',
  [OUTPUT_VAT_OUT_OF_SCOPE]: 'Out of scope',
}

// The one-word names on a register's selector, where three buttons share a row.
const BUTTON_NAME: Record<string, string> = {
  [OUTPUT_VAT_STANDARD]: 'VATable',
  [OUTPUT_VAT_GOVERNMENT]: 'Government',
  [OUTPUT_VAT_ZERO_RATED]: 'Zero-rated',
  [OUTPUT_VAT_EXEMPT]: 'VAT-exempt',
  [OUTPUT_VAT_OUT_OF_SCOPE]: 'Out of scope',
}

export function shortVatName(code: string): string {
  return BUTTON_NAME[code] ?? code
}

/** The classes offered before the master's list arrives (or if it cannot be
 * read): a picker that blanks would leave the cashier unable to ring a sale. */
const FALLBACK_OPTIONS: Pick<
  TaxCodeOption,
  'code' | 'name' | 'ratePercent' | 'requiresApproval' | 'isDefault'
>[] = [
  {
    code: OUTPUT_VAT_STANDARD,
    name: 'Output VAT - Standard VATable Sale',
    ratePercent: 12,
    requiresApproval: false,
    isDefault: true,
  },
  {
    code: OUTPUT_VAT_ZERO_RATED,
    name: 'Output VAT - Zero-rated Sale',
    ratePercent: 0,
    requiresApproval: true,
    isDefault: false,
  },
  {
    code: OUTPUT_VAT_EXEMPT,
    name: 'VAT Exempt Sale',
    ratePercent: 0,
    requiresApproval: true,
    isDefault: false,
  },
]

export type OutputVatOption = Pick<
  TaxCodeOption,
  'code' | 'name' | 'ratePercent' | 'requiresApproval' | 'isDefault'
>

/** The master's output VAT codes a document can take, in a fixed, familiar
 * order (VATable first). Falls back to the seeded three until the list loads. */
export function outputVatChoices(
  options: readonly TaxCodeOption[] | undefined,
  allowed: readonly string[]
): OutputVatOption[] {
  const source: readonly OutputVatOption[] =
    options && options.length > 0 ? options : FALLBACK_OPTIONS
  const byCode = new Map(source.map((o) => [o.code, o]))
  return allowed.map((code) => byCode.get(code)).filter((o): o is OutputVatOption => !!o)
}

/** "VATable sale (12%)", "Zero-rated sale", "VAT-exempt sale". */
export function outputVatLabel(code: string | null | undefined, ratePercent?: number): string {
  if (!code) return 'Not classified'
  const name = SHORT_NAME[code] ?? code
  return ratePercent && ratePercent > 0 ? `${name} (${Number(ratePercent.toFixed(4))}%)` : name
}

/** Zero-rated and exempt sales carry no output VAT; so does an out-of-scope
 * receipt. Everything else with a code is VATable. */
export function isRestrictedOutputVat(code: string | null | undefined): boolean {
  return (
    code === OUTPUT_VAT_ZERO_RATED || code === OUTPUT_VAT_EXEMPT || code === OUTPUT_VAT_OUT_OF_SCOPE
  )
}

/** Why a restricted class needs a document, in the words the screen uses. */
export function restrictedKind(code: string | null | undefined): string {
  return code === OUTPUT_VAT_ZERO_RATED ? 'zero-rated' : 'VAT-exempt'
}
