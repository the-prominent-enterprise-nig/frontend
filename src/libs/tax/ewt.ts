import type { TaxCodeOption } from '@/src/libs/data/AccountingV2Data'

// Scenario 69 Part D — expanded withholding (EWT) is read off the tax code
// master by the server, on the document's own date. The receiving and AP
// screens preview it with the same rates; this module is the one place that
// knows which code a supplier, a receiving line or a bill is withheld at.

/** The code that withholds nothing. */
export const NO_WITHHOLDING_CODE = 'EWT-NONE'
/** What a new supplier is withheld at — the 1% the supplier default always was. */
export const DEFAULT_WITHHOLDING_CODE = 'EWT-GOODS-1'

/** The code a receiving line's goods / services class is withheld at. */
export const WITHHOLDING_CLASS_CODES: Record<string, string> = {
  goods: 'EWT-GOODS-1',
  services: 'EWT-SERV-2',
}

// The workbook's provisional percentages. Only a stand-in while the master is
// loading or unreachable: a preview, never what is posted.
const FALLBACK_PERCENT: Record<string, number> = {
  [NO_WITHHOLDING_CODE]: 0,
  'EWT-GOODS-1': 1,
  'EWT-SERV-2': 2,
  'EWT-RENT-5': 5,
  'EWT-PROF-IND-5': 5,
  'EWT-PROF-IND-10': 10,
}

/** The rate of an EWT code as a fraction (0.05 = 5%). */
export type EwtRateFor = (code: string | null | undefined) => number

export const fallbackEwtRate: EwtRateFor = (code) => (FALLBACK_PERCENT[code ?? ''] ?? 0) / 100

/** A rate lookup over the master's codes in force today. */
export function ewtRateFor(options: readonly TaxCodeOption[] | undefined): EwtRateFor {
  if (!options || options.length === 0) return fallbackEwtRate
  const byCode = new Map(options.map((o) => [o.code, o.ratePercent / 100]))
  return (code) => (code ? (byCode.get(code) ?? fallbackEwtRate(code)) : 0)
}

/** The names of the classes a receiving line can be withheld under. */
export const WITHHOLDING_CLASS_NAMES: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
}

/** The code a line classed goods / services is withheld at; null for "none". */
export function classEwtCode(cls: string | null | undefined): string | null {
  return cls ? (WITHHOLDING_CLASS_CODES[cls] ?? null) : null
}

/** The code a supplier is withheld at. The old none/1% flag still wins when it
 * says none, exactly as on the server. */
export function supplierEwtCode(
  supplier:
    | {
        defaultWithholding?: 'none' | 'pct_1' | null
        defaultWithholdingTaxCode?: string | null
      }
    | null
    | undefined
): string {
  if (!supplier || supplier.defaultWithholding === 'none') return NO_WITHHOLDING_CODE
  return supplier.defaultWithholdingTaxCode || DEFAULT_WITHHOLDING_CODE
}

/** "5%", "1%", "0.5%" — a rate in percent, without trailing zeros. */
export function fmtPercent(ratePercent: number): string {
  return `${Number(ratePercent.toFixed(4))}%`
}

/** "EWT-RENT-5 — Real Property Rent (5%)". The master names its codes
 * "EWT - …"; the code already says that. */
export function ewtOptionLabel(
  option: Pick<TaxCodeOption, 'code' | 'name' | 'ratePercent'>
): string {
  const name = option.name.replace(/^EWT\s*-\s*/i, '')
  return option.ratePercent > 0
    ? `${option.code} — ${name} (${fmtPercent(option.ratePercent)})`
    : `${option.code} — ${name}`
}

/** "EWT-RENT-5 · 5%" — the code and its rate, short enough for a table cell. */
export function ewtShortLabel(option: Pick<TaxCodeOption, 'code' | 'ratePercent'>): string {
  return option.ratePercent > 0 ? `${option.code} · ${fmtPercent(option.ratePercent)}` : option.code
}

/** The picker's options: the master's EWT codes, plus — first — the one value
 * the record already carries if the master no longer offers it (switched off
 * since), so opening an old record never silently swaps it for another.
 * `label` words each option: the full "code — name (rate)" by default, or
 * ewtShortLabel for a narrow column. */
export function ewtSelectOptions(
  options: readonly TaxCodeOption[],
  current?: string,
  loading = false,
  label: (option: TaxCodeOption) => string = ewtOptionLabel
): { value: string; label: string }[] {
  const list = options.map((o) => ({ value: o.code, label: label(o) }))
  if (current && !options.some((o) => o.code === current)) {
    // While the list is still loading nothing is "gone" yet.
    list.unshift({ value: current, label: loading ? current : `${current} — no longer offered` })
  }
  return list
}

/** The none / goods / services choices of a receiving line, each with the rate
 * its code holds today ("Goods (1%)"). */
export function withholdingClassOptions(rateFor: EwtRateFor): { value: string; label: string }[] {
  const named = (cls: string) =>
    `${WITHHOLDING_CLASS_NAMES[cls]} (${fmtPercent(rateFor(WITHHOLDING_CLASS_CODES[cls]) * 100)})`
  return [
    { value: '', label: 'None' },
    { value: 'goods', label: named('goods') },
    { value: 'services', label: named('services') },
  ]
}
