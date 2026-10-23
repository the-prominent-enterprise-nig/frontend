import type { TaxCodeOption } from '@/src/libs/data/AccountingV2Data'

// Scenario 69 Part G — a purchase line (an AP bill line, an expense line) is
// coded with an input VAT treatment read off the tax code master. This module
// is the one place the screens learn which codes exist, what a line of each
// needs, and what a supplier of each VAT status starts on. The server decides
// (and re-checks) every rule here; nothing in this file is authoritative.

export const INPUT_VAT_STANDARD = 'VAT-IN-12'
export const INPUT_VAT_CAPEX = 'VAT-IN-CAPEX'
export const INPUT_VAT_NON_VAT = 'VAT-IN-NONVAT'
export const INPUT_VAT_EXEMPT = 'VAT-IN-EXEMPT'
export const INPUT_VAT_OUT_OF_SCOPE = 'VAT-IN-OOS'

/** What a purchase line can be coded as. VAT-IN-IMPORT is not seeded. */
export const INPUT_VAT_LINE_CODES: readonly string[] = [
  INPUT_VAT_STANDARD,
  INPUT_VAT_CAPEX,
  INPUT_VAT_NON_VAT,
  INPUT_VAT_EXEMPT,
  INPUT_VAT_OUT_OF_SCOPE,
]

export type SupplierVatStatus = 'VAT' | 'NON_VAT' | 'EXEMPT' | 'GOVERNMENT' | 'PEZA'

export const SUPPLIER_VAT_STATUSES: readonly SupplierVatStatus[] = [
  'VAT',
  'NON_VAT',
  'EXEMPT',
  'GOVERNMENT',
  'PEZA',
]

export const SUPPLIER_VAT_STATUS_LABEL: Record<SupplierVatStatus, string> = {
  VAT: 'VAT-registered',
  NON_VAT: 'Non-VAT',
  EXEMPT: 'VAT-exempt',
  GOVERNMENT: 'Government',
  PEZA: 'PEZA',
}

/** What each status means for the purchases made from the supplier. */
export const SUPPLIER_VAT_STATUS_HINT: Record<SupplierVatStatus, string> = {
  VAT: 'Charges 12% VAT: purchases start as claimable input VAT.',
  NON_VAT: 'Charges no VAT: nothing is claimed, and a claimable line is refused.',
  EXEMPT: 'Sells VAT-exempt: nothing is claimed, and a claimable line is refused.',
  GOVERNMENT:
    'May or may not charge VAT on an invoice: purchases start unclaimed; switch a line to VAT-IN-12 when the invoice shows VAT.',
  PEZA: 'May or may not charge VAT on an invoice: purchases start unclaimed; switch a line to VAT-IN-12 when the invoice shows VAT.',
}

/** The older none / 12% flag a status is the shadow of. */
export function legacyInputVatFlag(status: SupplierVatStatus): 'pct_12' | 'none' {
  return status === 'VAT' ? 'pct_12' : 'none'
}

/** A supplier's status from what a payload carries: the status itself, else the
 * older flag (12% = VAT-registered, none = non-VAT). */
export function supplierVatStatus(
  supplier:
    | { vatStatus?: SupplierVatStatus | null; defaultInputVat?: 'pct_12' | 'none' | null }
    | null
    | undefined
): SupplierVatStatus {
  if (!supplier) return 'VAT'
  if (supplier.vatStatus) return supplier.vatStatus
  return supplier.defaultInputVat === 'none' ? 'NON_VAT' : 'VAT'
}

/** The code a purchase from a supplier of this status starts on. */
export function defaultInputVatCode(status: SupplierVatStatus | null | undefined): string {
  switch (status) {
    case 'EXEMPT':
      return INPUT_VAT_EXEMPT
    case 'NON_VAT':
    case 'GOVERNMENT':
    case 'PEZA':
      return INPUT_VAT_NON_VAT
    default:
      return INPUT_VAT_STANDARD
  }
}

/** A non-VAT or exempt supplier cannot charge VAT at all, so nothing it bills
 * carries claimable input VAT. */
export function supplierMayChargeVat(status: SupplierVatStatus | null | undefined): boolean {
  return status !== 'NON_VAT' && status !== 'EXEMPT'
}

export function claimsInputVat(code: string | null | undefined): boolean {
  return code === INPUT_VAT_STANDARD || code === INPUT_VAT_CAPEX
}

/** A capital line is tagged to the project or asset it is for. */
export function needsProjectAssetRef(code: string | null | undefined): boolean {
  return code === INPUT_VAT_CAPEX
}

/** A capital line, and an out-of-scope one, names the account its net posts to. */
export function needsLineAccount(code: string | null | undefined): boolean {
  return code === INPUT_VAT_CAPEX || code === INPUT_VAT_OUT_OF_SCOPE
}

/** Account categories a capital good may be posted to: property, plant and
 * equipment, intangibles and the other non-current assets. */
export const CAPEX_ACCOUNT_CATEGORIES: readonly string[] = [
  'PROPERTY_PLANT_EQUIPMENT',
  'INTANGIBLE_ASSETS',
  'OTHER_NON_CURRENT_ASSETS',
]

/** True when the account is one a capital purchase may be posted to. */
export function isCapexAccount(account: {
  type?: string | null
  category?: string | null
}): boolean {
  return (
    (account.type ?? '').toUpperCase() === 'ASSET' &&
    !!account.category &&
    CAPEX_ACCOUNT_CATEGORIES.includes(account.category)
  )
}

export function isMasterInputVatCode(code: string | null | undefined): boolean {
  return !!code && /^VAT-IN-/i.test(code.trim())
}

const SHORT_NAME: Record<string, string> = {
  [INPUT_VAT_STANDARD]: 'VATable',
  [INPUT_VAT_CAPEX]: 'Capital goods',
  [INPUT_VAT_NON_VAT]: 'Non-VAT',
  [INPUT_VAT_EXEMPT]: 'VAT-exempt',
  [INPUT_VAT_OUT_OF_SCOPE]: 'Out of scope',
}

/** "VATable", "Capital goods", "Non-VAT"… — what a line's picker shows. */
export function inputVatShortName(code: string | null | undefined): string {
  if (!code) return 'Not coded'
  return SHORT_NAME[code] ?? code
}

export type InputVatOption = Pick<TaxCodeOption, 'code' | 'name' | 'ratePercent'>

// Offered before the master's list arrives (or if it cannot be read): a picker
// that blanks would leave a bill impossible to enter.
const FALLBACK_OPTIONS: InputVatOption[] = [
  { code: INPUT_VAT_STANDARD, name: 'Input VAT - Standard VATable Purchase', ratePercent: 12 },
  { code: INPUT_VAT_CAPEX, name: 'Input VAT - Capital Goods / Fixed Asset', ratePercent: 12 },
  { code: INPUT_VAT_NON_VAT, name: 'Non-VAT Purchase / No Input VAT', ratePercent: 0 },
  { code: INPUT_VAT_EXEMPT, name: 'VAT Exempt Purchase', ratePercent: 0 },
  { code: INPUT_VAT_OUT_OF_SCOPE, name: 'Out of Scope / Non-Tax Input', ratePercent: 0 },
]

/** The master's input VAT codes a purchase line can take, in a fixed, familiar
 * order. Falls back to the seeded five until the list loads. */
export function inputVatChoices(options: readonly TaxCodeOption[] | undefined): InputVatOption[] {
  const source: readonly InputVatOption[] =
    options && options.length > 0 ? options : FALLBACK_OPTIONS
  const byCode = new Map(source.map((o) => [o.code, o]))
  return INPUT_VAT_LINE_CODES.map((code) => byCode.get(code)).filter(
    (o): o is InputVatOption => !!o
  )
}

/** "VAT-IN-12 — VATable (12%)": a code's picker label. */
export function inputVatOptionLabel(option: InputVatOption): string {
  const rate = option.ratePercent > 0 ? ` (${Number(option.ratePercent.toFixed(4))}%)` : ''
  return `${inputVatShortName(option.code)}${rate}`
}

/** The VAT a line's net carries at a code's rate: 12% of a VAT-exclusive
 * amount, centavo-rounded the way the server does it. */
export function inputVatOn(net: number, ratePercent: number): number {
  return Math.round(net * (ratePercent / 100) * 100) / 100
}
